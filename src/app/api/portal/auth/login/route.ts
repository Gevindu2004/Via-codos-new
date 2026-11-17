import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword, signClientToken, CLIENT_COOKIE } from "@/lib/auth";
import {
  checkLoginLockout,
  checkRateLimit,
  clearLoginFailures,
  getClientIp,
  recordLoginFailure,
} from "@/lib/security";

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req.headers);
    const ipLimit = checkRateLimit(`portal-login-ip:${ip}`, 30, 15 * 60 * 1000);
    if (!ipLimit.allowed) {
      return NextResponse.json(
        { error: "Too many login attempts. Please try again later." },
        { status: 429, headers: { "Retry-After": String(ipLimit.retryAfterSec) } }
      );
    }

    const { email, password } = await req.json();
    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
    }

    const cleanEmail = String(email).toLowerCase().trim();
    const lockKey = `client:${ip}:${cleanEmail}`;
    const lockState = checkLoginLockout(lockKey);
    if (lockState.locked) {
      return NextResponse.json(
        { error: `Too many failed attempts. Try again in ${lockState.retryAfterSec}s.` },
        { status: 429, headers: { "Retry-After": String(lockState.retryAfterSec) } }
      );
    }

    const client = await prisma.clientUser.findUnique({ where: { email: cleanEmail } });
    if (!client || !verifyPassword(String(password), client.passwordHash)) {
      recordLoginFailure(lockKey);
      return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
    }

    clearLoginFailures(lockKey);

    const token = await signClientToken({
      clientId: client.id,
      email: client.email,
      name: client.name,
      companyName: client.companyName,
      verificationStatus: client.verificationStatus,
      kind: "client",
    });

    const res = NextResponse.json({
      client: {
        id: client.id,
        name: client.name,
        email: client.email,
        companyName: client.companyName,
        verificationStatus: client.verificationStatus,
      },
    });
    res.cookies.set(CLIENT_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 14,
    });
    return res;
  } catch {
    return NextResponse.json({ error: "Login failed." }, { status: 500 });
  }
}
