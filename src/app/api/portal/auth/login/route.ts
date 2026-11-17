import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword, signClientToken, CLIENT_COOKIE } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();
    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
    }
    const client = await prisma.clientUser.findUnique({
      where: { email: String(email).toLowerCase().trim() },
    });
    if (!client || !verifyPassword(String(password), client.passwordHash)) {
      return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
    }

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
      path: "/",
      maxAge: 60 * 60 * 24 * 14,
    });
    return res;
  } catch {
    return NextResponse.json({ error: "Login failed." }, { status: 500 });
  }
}

