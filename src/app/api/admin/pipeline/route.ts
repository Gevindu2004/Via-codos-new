import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth";
import { recordAuditLog } from "@/lib/audit";
import { dispatchEmail } from "@/lib/email";

export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [clients, requests, inquiries] = await Promise.all([
    prisma.clientUser.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.profileRequest.findMany({
      include: {
        client: { select: { id: true, name: true, email: true, companyName: true, verificationStatus: true } },
        talent: { select: { id: true, profileCode: true, roleTitle: true, domainName: true, placementStatus: true, monthlyRateUsd: true } },
        interviews: true,
        meetings: true,
      },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.staffingInquiry.findMany({ orderBy: { createdAt: "desc" } }),
  ]);

  return NextResponse.json({ clients, requests, inquiries });
}

export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { action } = body;

    if (action === "VERIFY_CLIENT") {
      const updated = await prisma.clientUser.update({
        where: { id: body.clientId },
        data: {
          verificationStatus: body.status, // VERIFIED | REJECTED
          verificationNotes: body.notes || null,
          verifiedAt: body.status === "VERIFIED" ? new Date() : null,
        },
      });
      await recordAuditLog({
        actorId: session.userId,
        actorEmail: session.email,
        actorRole: session.role,
        action: "VERIFY_CLIENT",
        entityType: "ClientUser",
        entityId: updated.id,
        entityLabel: updated.companyName,
        summary: `Set verification status of ${updated.companyName} to ${body.status}`,
      });
      return NextResponse.json({ client: updated });
    }

    if (action === "APPROVE_PROFILE_REQUEST") {
      const pipe = await prisma.profileRequest.findUnique({
        where: { id: body.requestId },
        include: { client: true, talent: true },
      });
      if (!pipe) return NextResponse.json({ error: "Request not found." }, { status: 404 });

      const dossier = {
        profileCode: pipe.talent.profileCode,
        architectureStrengths: JSON.parse(pipe.talent.skillsJson).slice(0, 4),
        timezoneOverlap: "4–8 hours overlap with US / UK / EU / AU",
        vettingScores: {
          technicalScreening: "95/100",
          systemDesign: "93/100",
          communication: "96/100",
        },
      };

      const updated = await prisma.profileRequest.update({
        where: { id: pipe.id },
        data: {
          stage: "APPROVED",
          adminApprovalNotes: body.notes || "Approved for full anonymized dossier release and AI interview scheduling.",
          approvedAt: new Date(),
          approvedBy: session.email,
          releasedDossierJson: JSON.stringify(dossier),
        },
      });

      await dispatchEmail({
        toEmail: pipe.client.email,
        subject: `Profile Approved: ${pipe.talent.profileCode} — Via Codos Client Portal`,
        bodyText: `Dear ${pipe.client.name},\n\nYour request for Profile ${pipe.talent.profileCode} (${pipe.talent.roleTitle}) has been approved! Log in to /portal to inspect the released dossier and schedule your AI interview.`,
        relatedEntity: `ProfileRequest:${pipe.id}`,
      });

      await recordAuditLog({
        actorId: session.userId,
        actorEmail: session.email,
        actorRole: session.role,
        action: "APPROVE",
        entityType: "ProfileRequest",
        entityId: pipe.id,
        entityLabel: `${pipe.client.companyName} -> ${pipe.talent.profileCode}`,
        summary: `Approved full profile release for ${pipe.talent.profileCode} to ${pipe.client.companyName}`,
      });
      return NextResponse.json({ request: updated });
    }

    if (action === "UPDATE_INQUIRY_STATUS") {
      const updated = await prisma.staffingInquiry.update({
        where: { id: body.inquiryId },
        data: { status: body.status },
      });
      return NextResponse.json({ inquiry: updated });
    }

    if (action === "MARK_PLACED") {
      const pipe = await prisma.profileRequest.findUnique({ where: { id: body.requestId } });
      if (!pipe) return NextResponse.json({ error: "Request not found." }, { status: 404 });
      await prisma.profileRequest.update({ where: { id: pipe.id }, data: { stage: "HIRED" } });
      await prisma.talentProfile.update({
        where: { id: pipe.talentId },
        data: { placementStatus: "PLACED" },
      });
      await recordAuditLog({
        actorId: session.userId,
        actorEmail: session.email,
        actorRole: session.role,
        action: "MARK_PLACED",
        entityType: "TalentProfile",
        entityId: pipe.talentId,
        entityLabel: pipe.talentId,
        summary: `Marked talent profile Placed via pipeline request ${pipe.id}`,
      });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (err) {
    console.error("Admin pipeline error:", err);
    return NextResponse.json({ error: "Pipeline action failed." }, { status: 500 });
  }
}

