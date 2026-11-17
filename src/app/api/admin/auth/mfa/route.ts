import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth";
import { recordAuditLog } from "@/lib/audit";
import {
  buildOtpAuthUri,
  decryptSensitive,
  encryptSensitive,
  generateTotpSecret,
  verifyTotpCode,
} from "@/lib/security";

export async function GET() {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = await prisma.adminUser.findUnique({
    where: { id: session.userId },
    select: { mfaEnabled: true },
  });
  return NextResponse.json({ mfaEnabled: Boolean(user?.mfaEnabled) });
}

export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { action, totpCode } = await req.json();
    const user = await prisma.adminUser.findUnique({ where: { id: session.userId } });
    if (!user) {
      return NextResponse.json({ error: "Admin account not found." }, { status: 404 });
    }

    if (action === "SETUP") {
      const secret = generateTotpSecret();
      await prisma.adminUser.update({
        where: { id: user.id },
        data: { mfaSecret: encryptSensitive(secret), mfaEnabled: false },
      });
      return NextResponse.json({
        secret,
        otpAuthUri: buildOtpAuthUri(user.email, secret),
      });
    }

    if (action === "ENABLE") {
      if (!user.mfaSecret) {
        return NextResponse.json({ error: "Generate an MFA secret first." }, { status: 400 });
      }
      const secret = decryptSensitive(user.mfaSecret);
      if (!secret || !verifyTotpCode(secret, String(totpCode || ""))) {
        return NextResponse.json({ error: "Invalid 6-digit authenticator code." }, { status: 400 });
      }
      await prisma.adminUser.update({
        where: { id: user.id },
        data: { mfaEnabled: true },
      });
      await recordAuditLog({
        actorId: user.id,
        actorEmail: user.email,
        actorRole: user.role,
        action: "UPDATE",
        entityType: "AdminUser",
        entityId: user.id,
        entityLabel: user.email,
        summary: `Enabled TOTP MFA for ${user.email}`,
      });
      return NextResponse.json({ mfaEnabled: true });
    }

    if (action === "DISABLE") {
      if (user.mfaEnabled && user.mfaSecret) {
        const secret = decryptSensitive(user.mfaSecret);
        if (!secret || !verifyTotpCode(secret, String(totpCode || ""))) {
          return NextResponse.json(
            { error: "Provide a valid 6-digit code to disable MFA." },
            { status: 400 }
          );
        }
      }
      await prisma.adminUser.update({
        where: { id: user.id },
        data: { mfaEnabled: false, mfaSecret: null },
      });
      await recordAuditLog({
        actorId: user.id,
        actorEmail: user.email,
        actorRole: user.role,
        action: "UPDATE",
        entityType: "AdminUser",
        entityId: user.id,
        entityLabel: user.email,
        summary: `Disabled TOTP MFA for ${user.email}`,
      });
      return NextResponse.json({ mfaEnabled: false });
    }

    return NextResponse.json({ error: "Unknown MFA action." }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "MFA operation failed." }, { status: 500 });
  }
}

