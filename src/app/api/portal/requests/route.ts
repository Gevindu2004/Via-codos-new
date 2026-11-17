import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getClientSession } from "@/lib/auth";
import { anonymizeTalentProfile } from "@/lib/sanitize";
import { dispatchEmail } from "@/lib/email";

export async function GET() {
  const session = await getClientSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const client = await prisma.clientUser.findUnique({ where: { id: session.clientId } });
  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  const requests = await prisma.profileRequest.findMany({
    where: { clientId: client.id },
    include: {
      talent: true,
      interviews: { orderBy: { createdAt: "desc" } },
      meetings: { orderBy: { createdAt: "desc" } },
    },
    orderBy: { updatedAt: "desc" },
  });

  // Fetch linked signature requests
  const reqIds = requests.map((r) => r.id);
  const signatures = await prisma.signatureRequest.findMany({
    where: { pipelineRequestId: { in: reqIds } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    client: {
      id: client.id,
      name: client.name,
      email: client.email,
      companyName: client.companyName,
      companyWebsite: client.companyWebsite,
      companyCountry: client.companyCountry,
      verificationStatus: client.verificationStatus,
      verificationNotes: client.verificationNotes,
    },
    requests: requests.map((r) => ({
      id: r.id,
      stage: r.stage,
      requestNotes: r.requestNotes,
      adminApprovalNotes: r.adminApprovalNotes,
      approvedAt: r.approvedAt,
      releasedDossier:
        r.stage !== "REQUESTED" && r.stage !== "REJECTED" && r.releasedDossierJson
          ? JSON.parse(r.releasedDossierJson)
          : null,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      talent: anonymizeTalentProfile(r.talent),
      interviews: r.interviews,
      meetings: r.meetings,
      signatureRequests: signatures.filter((s) => s.pipelineRequestId === r.id),
    })),
  });
}

export async function POST(req: NextRequest) {
  const session = await getClientSession();
  if (!session) {
    return NextResponse.json(
      { error: "Please sign in to the Client Portal to request a full profile." },
      { status: 401 }
    );
  }

  const { talentId, requestNotes } = await req.json();
  if (!talentId) {
    return NextResponse.json({ error: "talentId is required." }, { status: 400 });
  }

  const talent = await prisma.talentProfile.findUnique({ where: { id: String(talentId) } });
  if (!talent || talent.placementStatus === "PLACED") {
    return NextResponse.json(
      { error: "This talent profile is not available." },
      { status: 400 }
    );
  }

  const existing = await prisma.profileRequest.findFirst({
    where: {
      clientId: session.clientId,
      talentId: talent.id,
      stage: { notIn: ["REJECTED"] },
    },
  });
  if (existing) {
    return NextResponse.json(
      { error: "You already have an active pipeline request for this profile." },
      { status: 409 }
    );
  }

  const created = await prisma.profileRequest.create({
    data: {
      clientId: session.clientId,
      talentId: talent.id,
      stage: "REQUESTED",
      requestNotes: requestNotes ? String(requestNotes) : null,
    },
  });

  await dispatchEmail({
    toEmail: process.env.ADMIN_NOTIFY_EMAIL || "info@viacodos.com",
    subject: `Profile Request [${talent.profileCode}] from ${session.companyName}`,
    bodyText: `Client ${session.name} (${session.companyName}) requested full profile for ${talent.profileCode} (${talent.roleTitle}). Review & approve in /admin/pipeline.`,
    relatedEntity: `ProfileRequest:${created.id}`,
  });

  return NextResponse.json({ request: created });
}

