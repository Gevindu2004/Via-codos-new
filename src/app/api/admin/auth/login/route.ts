import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword, signAdminToken, ADMIN_COOKIE } from "@/lib/auth";
import { recordAuditLog } from "@/lib/audit";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();
    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
    }

    const user = await prisma.adminUser.findUnique({
      where: { email: String(email).toLowerCase().trim() },
    });
    if (!user || !user.isActive || !verifyPassword(String(password), user.passwordHash)) {
      return NextResponse.json({ error: "Invalid administrator credentials." }, { status: 401 });
    }

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
    });

    const res = NextResponse.json({
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    });
    res.cookies.set(ADMIN_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
    return res;
  } catch {
    return NextResponse.json({ error: "Authentication error." }, { status: 500 });
  }
}

