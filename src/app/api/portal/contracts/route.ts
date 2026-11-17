import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getClientSession } from "@/lib/auth";
import { escapeHtml, sanitizeRichHtml } from "@/lib/security";

export async function POST(req: NextRequest) {
  const session = await getClientSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { pipelineRequestId } = await req.json();
  const pipe = await prisma.profileRequest.findUnique({
    where: { id: String(pipelineRequestId) },
    include: { client: true, talent: true },
  });
  if (!pipe || pipe.clientId !== session.clientId) {
    return NextResponse.json({ error: "Pipeline request not found." }, { status: 404 });
  }

  // Find SOW template (or any private template)
  const template =
    (await prisma.legalDocument.findUnique({ where: { slug: "template-staff-augmentation-sow" } })) ||
    (await prisma.legalDocument.findFirst({ where: { isTemplate: true, status: "PUBLISHED" } }));

  if (!template) {
    return NextResponse.json({ error: "No contract template configured." }, { status: 500 });
  }

  const effectiveDate = new Date().toISOString().slice(0, 10);
  const renderedHtml = sanitizeRichHtml(
    template.contentHtml
      .replace(/\{\{effectiveDate\}\}/g, escapeHtml(effectiveDate))
      .replace(/\{\{clientName\}\}/g, escapeHtml(pipe.client.name))
      .replace(/\{\{clientEmail\}\}/g, escapeHtml(pipe.client.email))
      .replace(/\{\{clientCompany\}\}/g, escapeHtml(pipe.client.companyName))
      .replace(/\{\{profileCode\}\}/g, escapeHtml(pipe.talent.profileCode))
      .replace(/\{\{roleTitle\}\}/g, escapeHtml(pipe.talent.roleTitle))
      .replace(/\{\{monthlyRateUsd\}\}/g, escapeHtml(String(pipe.talent.monthlyRateUsd)))
  );

  const token = `sign-${crypto.randomBytes(10).toString("hex")}`;
  const sigReq = await prisma.signatureRequest.create({
    data: {
      token,
      documentId: template.id,
      documentTitle: `${template.title} — ${pipe.talent.profileCode}`,
      documentVersion: template.version,
      renderedHtml,
      clientName: pipe.client.name,
      clientEmail: pipe.client.email,
      clientCompany: pipe.client.companyName,
      pipelineRequestId: pipe.id,
      createdBy: session.email,
    },
  });

  await prisma.profileRequest.update({
    where: { id: pipe.id },
    data: { stage: "CONTRACT" },
  });

  return NextResponse.json({
    signatureRequest: sigReq,
    signUrl: `/sign/${token}`,
  });
}

