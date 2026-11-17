import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getClientSession } from "@/lib/auth";
import { dispatchEmail } from "@/lib/email";

export async function POST(req: NextRequest) {
  const session = await getClientSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { pipelineRequestId, scheduledSlot, timezone, questions } = await req.json();
  if (!pipelineRequestId || !scheduledSlot || !Array.isArray(questions) || questions.length === 0) {
    return NextResponse.json(
      { error: "Pipeline request, time slot, and at least one interview question are required." },
      { status: 400 }
    );
  }

  const pipe = await prisma.profileRequest.findUnique({
    where: { id: String(pipelineRequestId) },
    include: { talent: true },
  });
  if (!pipe || pipe.clientId !== session.clientId) {
    return NextResponse.json({ error: "Pipeline request not found." }, { status: 404 });
  }
  if (pipe.stage === "REQUESTED" || pipe.stage === "REJECTED") {
    return NextResponse.json(
      { error: "Admin must approve the profile release before scheduling an AI interview." },
      { status: 400 }
    );
  }

  const token = `ai-${crypto.randomBytes(8).toString("hex")}`;
  const interview = await prisma.aiInterviewSession.create({
    data: {
      pipelineRequestId: pipe.id,
      token,
      scheduledSlot: new Date(scheduledSlot),
      timezone: String(timezone || "UTC"),
      candidateInviteSentAt: new Date(),
      questionsJson: JSON.stringify(questions.map((q: string) => String(q).trim()).filter(Boolean)),
      status: "SCHEDULED",
    },
  });

  if (pipe.stage === "APPROVED") {
    await prisma.profileRequest.update({
      where: { id: pipe.id },
      data: { stage: "INTERVIEW" },
    });
  }

  await dispatchEmail({
    toEmail: process.env.ADMIN_NOTIFY_EMAIL || "info@viacodos.com",
    ccEmail: session.email,
    subject: `AI Interview Scheduled for ${pipe.talent.profileCode} (${session.companyName})`,
    bodyText: `AI Interview scheduled for ${scheduledSlot} (${timezone || "UTC"}).\nCandidate Room Link: /interview/${token}\nCustomized Questions: ${questions.length}`,
    relatedEntity: `AiInterviewSession:${interview.id}`,
  });

  return NextResponse.json({ interview });
}

