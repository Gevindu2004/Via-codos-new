import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword, signAdminToken, ADMIN_COOKIE } from "@/lib/auth";
import { recordAuditLog } from "@/lib/audit";
import {
  checkLoginLockout,
  checkRateLimit,
  clearLoginFailures,
  decryptSensitive,
  getClientIp,
  recordLoginFailure,
  verifyTotpCode,
} from "@/lib/security";

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req.headers);
    const ipLimit = checkRateLimit(`admin-login-ip:${ip}`, 20, 15 * 60 * 1000);
    if (!ipLimit.allowed) {
      return NextResponse.json(
        { error: "Too many login attempts. Please try again later." },
        { status: 429, headers: { "Retry-After": String(ipLimit.retryAfterSec) } }
      );
    }

    const { email, password, totpCode } = await req.json();
    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
    }

    const cleanEmail = String(email).toLowerCase().trim();
    const lockKey = `admin:${ip}:${cleanEmail}`;
    const lockState = checkLoginLockout(lockKey);
    if (lockState.locked) {
      return NextResponse.json(
        { error: `Account temporarily locked due to repeated failed logins. Try again in ${lockState.retryAfterSec}s.` },
        { status: 429, headers: { "Retry-After": String(lockState.retryAfterSec) } }
      );
    }

    const user = await prisma.adminUser.findUnique({ where: { email: cleanEmail } });
    if (!user || !user.isActive || !verifyPassword(String(password), user.passwordHash)) {
      recordLoginFailure(lockKey);
      return NextResponse.json({ error: "Invalid administrator credentials." }, { status: 401 });
    }

    // Enforce TOTP MFA when enabled on this admin account
    if (user.mfaEnabled && user.mfaSecret) {
      if (!totpCode) {
        return NextResponse.json({ mfaRequired: true });
      }
      const decryptedSecret = decryptSensitive(user.mfaSecret);
      if (!decryptedSecret || !verifyTotpCode(decryptedSecret, String(totpCode))) {
        recordLoginFailure(lockKey);
        return NextResponse.json({ error: "Invalid MFA authenticator code.", mfaRequired: true }, { status: 401 });
      }
    }

    clearLoginFailures(lockKey);

    const token = await signAdminToken({
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      kind: "admin",
    });

    await recordAuditLog({
      actorId: user.id,
      actorEmail: user.email,
      actorRole: user.role,
      action: "LOGIN",
      entityType: "AdminUser",
      entityId: user.id,
      entityLabel: user.email,
      summary: `Administrator ${user.email} signed in to /admin`,
      ipAddress: ip,
    });

    const res = NextResponse.json({
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    });
    res.cookies.set(ADMIN_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 12,
    });
    return res;
  } catch {
    return NextResponse.json({ error: "Authentication error." }, { status: 500 });
  }
}
