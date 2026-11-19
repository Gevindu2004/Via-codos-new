import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  ENGINEER_COOKIE,
  signEngineerToken,
  verifyPassword,
} from "@/lib/auth";
import {
  checkLoginLockout,
  checkRateLimit,
  clearLoginFailures,
  getClientIp,
  recordLoginFailure,
} from "@/lib/security";
import { findEngineerAccountByIdentifier } from "@/lib/engineer-store";

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req.headers);
    const rate = checkRateLimit(`engineer-login:${ip}`, 15, 15 * 60 * 1000);
    if (!rate.allowed) {
      return NextResponse.json(
        { error: "Too many login attempts. Please try again later." },
        { status: 429, headers: { "Retry-After": String(rate.retryAfterSec) } }
      );
    }

    const { identifier, password } = await req.json();
    const cleanId = String(identifier || "").trim();
    if (!cleanId || !password) {
      return NextResponse.json(
        { error: "Staff ID or Email and password are required." },
        { status: 400 }
      );
    }

    const lockKey = `engineer:${cleanId.toLowerCase()}:${ip}`;
    const lock = checkLoginLockout(lockKey);
    if (lock.locked) {
      return NextResponse.json(
        { error: "Account temporarily locked due to repeated failures. Try again later." },
        { status: 429, headers: { "Retry-After": String(lock.retryAfterSec) } }
      );
    }

    const account = await findEngineerAccountByIdentifier(cleanId);
    if (!account || account.status !== "ACTIVE" || !verifyPassword(String(password), account.passwordHash)) {
      recordLoginFailure(lockKey);
      return NextResponse.json({ error: "Invalid engineer credentials." }, { status: 401 });
    }

    const talent = await prisma.talentProfile.findUnique({ where: { id: account.talentId } });
    if (!talent) {
      return NextResponse.json({ error: "Linked talent profile not found." }, { status: 404 });
    }

    clearLoginFailures(lockKey);

    const token = await signEngineerToken({
      engineerId: account.id,
      talentId: account.talentId,
      profileCode: account.profileCode,
      email: account.email,
      name: account.name,
      roleTitle: talent.roleTitle,
      kind: "engineer",
    });

    const res = NextResponse.json({
      engineer: {
        id: account.id,
        profileCode: account.profileCode,
        email: account.email,
        name: account.name,
        roleTitle: talent.roleTitle,
      },
    });
    res.cookies.set(ENGINEER_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 12,
    });
    return res;
  } catch (err) {
    console.error("Engineer login error:", err);
    return NextResponse.json({ error: "Failed to sign in." }, { status: 500 });
  }
}

