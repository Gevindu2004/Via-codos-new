import crypto from "node:crypto";
import { Router } from "express";
import { prisma } from "../lib/prisma";
import { anonymizeTalentProfile } from "../lib/sanitize";
import { dispatchEmail } from "../lib/email";
import { escapeHtml, sanitizeRichHtml } from "../lib/security";
import { requireClient, type AuthenticatedRequest } from "../middleware/auth";

export const portalRouter = Router();

portalRouter.use("/portal", requireClient);

// Client Portal pipeline & requests
portalRouter.get("/portal/requests", async (req: AuthenticatedRequest, res) => {
  try {
    const session = req.clientSession!;
    const client = await prisma.clientUser.findUnique({ where: { id: session.clientId } });
    if (!client) {
      res.status(404).json({ error: "Client not found" });
      return;
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

    const reqIds = requests.map((r) => r.id);
    const signatures =
      reqIds.length > 0
        ? await prisma.signatureRequest.findMany({
            where: { pipelineRequestId: { in: reqIds } },
            orderBy: { createdAt: "desc" },
          })
        : [];

    res.json({
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
  } catch (err) {
    console.error("Portal requests GET error:", err);
    res.status(500).json({ error: "Failed to load portal requests." });
  }
});

portalRouter.post("/portal/requests", async (req: AuthenticatedRequest, res) => {
  try {
    const session = req.clientSession!;
    const { talentId, requestNotes } = req.body ?? {};
    if (!talentId) {
      res.status(400).json({ error: "talentId is required." });
      return;
    }

    const client = await prisma.clientUser.findUnique({ where: { id: session.clientId } });
    if (!client || client.verificationStatus !== "VERIFIED") {
      res.status(403).json({
        error: "Your company account must be verified by Via Codos before requesting full profiles.",
      });
      return;
    }

    const talent = await prisma.talentProfile.findUnique({ where: { id: String(talentId) } });
    if (!talent || talent.placementStatus === "PLACED") {
      res.status(400).json({ error: "This talent profile is not available." });
      return;
    }

    const existing = await prisma.profileRequest.findFirst({
      where: {
        clientId: session.clientId,
        talentId: talent.id,
        stage: { notIn: ["REJECTED"] },
      },
    });
    if (existing) {
      res.status(409).json({
        error: "You already have an active pipeline request for this profile.",
      });
      return;
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

    res.json({ request: created });
  } catch (err) {
    console.error("Portal request POST error:", err);
    res.status(500).json({ error: "Failed to submit profile request." });
  }
});

// Generate contract e-sign link for a pipeline request
portalRouter.post("/portal/contracts", async (req: AuthenticatedRequest, res) => {
  try {
    const session = req.clientSession!;
    const { pipelineRequestId } = req.body ?? {};
    const pipe = await prisma.profileRequest.findUnique({
      where: { id: String(pipelineRequestId) },
      include: { client: true, talent: true },
    });
    if (!pipe || pipe.clientId !== session.clientId) {
      res.status(404).json({ error: "Pipeline request not found." });
      return;
    }

    const template =
      (await prisma.legalDocument.findUnique({
        where: { slug: "template-staff-augmentation-sow" },
      })) ||
      (await prisma.legalDocument.findFirst({
        where: { isTemplate: true, status: "PUBLISHED" },
      }));

    if (!template) {
      res.status(500).json({ error: "No contract template configured." });
      return;
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

    res.json({ signatureRequest: sigReq, signUrl: `/sign/${token}` });
  } catch (err) {
    console.error("Portal contract error:", err);
    res.status(500).json({ error: "Failed to initiate contract." });
  }
});

// Schedule AI Interview
portalRouter.post("/portal/interviews", async (req: AuthenticatedRequest, res) => {
  try {
    const session = req.clientSession!;
    const { pipelineRequestId, scheduledSlot, timezone, questions } = req.body ?? {};
    if (!pipelineRequestId || !scheduledSlot || !Array.isArray(questions) || questions.length === 0) {
      res.status(400).json({
        error: "Pipeline request, time slot, and at least one interview question are required.",
      });
      return;
    }

    const pipe = await prisma.profileRequest.findUnique({
      where: { id: String(pipelineRequestId) },
      include: { talent: true },
    });
    if (!pipe || pipe.clientId !== session.clientId) {
      res.status(404).json({ error: "Pipeline request not found." });
      return;
    }
    if (pipe.stage === "REQUESTED" || pipe.stage === "REJECTED") {
      res.status(400).json({
        error: "Admin must approve the profile release before scheduling an AI interview.",
      });
      return;
    }

    const token = `ai-${crypto.randomBytes(8).toString("hex")}`;
    const interview = await prisma.aiInterviewSession.create({
      data: {
        pipelineRequestId: pipe.id,
        token,
        scheduledSlot: new Date(scheduledSlot),
        timezone: String(timezone || "UTC"),
        candidateInviteSentAt: new Date(),
        questionsJson: JSON.stringify(
          questions.map((q: string) => String(q).trim()).filter(Boolean)
        ),
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

    res.json({ interview });
  } catch (err) {
    console.error("Portal interview error:", err);
    res.status(500).json({ error: "Failed to schedule AI interview." });
  }
});

// Schedule & update 3-way management meetings
portalRouter.post("/portal/meetings", async (req: AuthenticatedRequest, res) => {
  try {
    const session = req.clientSession!;
    const { pipelineRequestId, scheduledSlot, timezone, notes } = req.body ?? {};
    if (!pipelineRequestId || !scheduledSlot) {
      res.status(400).json({ error: "Pipeline request and time slot are required." });
      return;
    }

    const pipe = await prisma.profileRequest.findUnique({
      where: { id: String(pipelineRequestId) },
      include: { talent: true },
    });
    if (!pipe || pipe.clientId !== session.clientId) {
      res.status(404).json({ error: "Pipeline request not found." });
      return;
    }

    const meetingRoomCode = crypto.randomBytes(4).toString("hex");
    const meeting = await prisma.managementMeeting.create({
      data: {
        pipelineRequestId: pipe.id,
        scheduledSlot: new Date(scheduledSlot),
        timezone: String(timezone || "UTC"),
        meetingLink: `https://meet.viacodos.com/3way-${meetingRoomCode}`,
        attendeesJson: JSON.stringify([
          `${session.name} (Client - ${session.companyName})`,
          "Via Codos Delivery Management Lead",
          `Candidate ${pipe.talent.profileCode}`,
        ]),
        notes: notes ? String(notes) : "",
        status: "SCHEDULED",
      },
    });

    if (["APPROVED", "INTERVIEW"].includes(pipe.stage)) {
      await prisma.profileRequest.update({
        where: { id: pipe.id },
        data: { stage: "MEETING" },
      });
    }

    await dispatchEmail({
      toEmail: session.email,
      ccEmail: process.env.ADMIN_NOTIFY_EMAIL || "info@viacodos.com",
      subject: `3-Way Management Meeting Confirmed [${pipe.talent.profileCode}]`,
      bodyText: `Three-way meeting via Via Codos Management booked for ${scheduledSlot} (${timezone || "UTC"}).\nMeeting Room: ${meeting.meetingLink}\nNotes: ${notes || "None"}`,
      relatedEntity: `ManagementMeeting:${meeting.id}`,
    });

    res.json({ meeting });
  } catch (err) {
    console.error("Portal meeting POST error:", err);
    res.status(500).json({ error: "Failed to book meeting." });
  }
});

portalRouter.patch("/portal/meetings", async (req: AuthenticatedRequest, res) => {
  try {
    const session = req.clientSession!;
    const { meetingId, notes } = req.body ?? {};
    const meeting = await prisma.managementMeeting.findUnique({
      where: { id: String(meetingId) },
      include: { pipelineRequest: true },
    });
    if (!meeting || meeting.pipelineRequest.clientId !== session.clientId) {
      res.status(404).json({ error: "Meeting not found." });
      return;
    }

    const updated = await prisma.managementMeeting.update({
      where: { id: meeting.id },
      data: { notes: String(notes || "") },
    });
    res.json({ meeting: updated });
  } catch (err) {
    console.error("Portal meeting PATCH error:", err);
    res.status(500).json({ error: "Failed to update meeting notes." });
  }
});

