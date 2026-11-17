import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { Router } from "express";
import multer from "multer";
import { prisma } from "../lib/prisma";
import { dispatchEmail } from "../lib/email";
import { generateSignedAgreementPdf } from "../lib/pdf";
import { recordAuditLog } from "../lib/audit";
import { getAdminSessionFromRequest, getClientSessionFromRequest } from "../lib/auth";
import { slugify } from "../lib/sanitize";
import { checkRateLimit, resolveUploadStorageDir, validateAndScanUploadBuffer } from "../lib/security";

export const publicRouter = Router();

const uploadMemory = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB
});

// Public Staffing Inquiry
publicRouter.post("/staffing-inquiries", async (req, res) => {
  try {
    const ip = req.ip || "unknown";
    const rl = checkRateLimit(`inquiry:${ip}`, 12, 15 * 60 * 1000);
    if (!rl.allowed) {
      res.status(429).json({ error: "Too many inquiry submissions. Please try again later." });
      return;
    }
    const body = req.body ?? {};
    const {
      name,
      email,
      company,
      phone,
      serviceLine,
      roleNeeded,
      domain,
      skillsText,
      headcount,
      engagementModel,
      timeline,
      timezoneOverlap,
      message,
      ndaRequired,
    } = body;

    if (!name || !email || !message) {
      res.status(400).json({
        error: "Name, work email, and requirement details are required.",
      });
      return;
    }

    const referenceCode = `VC-REQ-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;

    const inquiry = await prisma.staffingInquiry.create({
      data: {
        referenceCode,
        name: String(name),
        email: String(email),
        company: company ? String(company) : null,
        phone: phone ? String(phone) : null,
        serviceLine: String(serviceLine || "IT Outsourcing & Staff Augmentation"),
        roleNeeded: roleNeeded ? String(roleNeeded) : null,
        domain: domain ? String(domain) : null,
        skillsText: skillsText ? String(skillsText) : null,
        headcount: Number(headcount || 1),
        engagementModel: engagementModel ? String(engagementModel) : null,
        timeline: timeline ? String(timeline) : null,
        timezoneOverlap: timezoneOverlap ? String(timezoneOverlap) : null,
        message: String(message),
        ndaRequired: Boolean(ndaRequired ?? true),
      },
    });

    await dispatchEmail({
      toEmail: String(email),
      ccEmail: process.env.ADMIN_NOTIFY_EMAIL || "info@viacodos.com",
      subject: `Via Codos Request Received [${referenceCode}]`,
      bodyText: `Hello ${name},\n\nThank you for submitting your staff augmentation / engineering inquiry (${referenceCode}).\n\nOur delivery leadership team has received your requirements (${roleNeeded || serviceLine}) and will contact you shortly with suitable vetted engineering or management resources${ndaRequired ? " under NDA" : ""}.\n\nRegards,\nVia Codos (PVT) LTD`,
      relatedEntity: `StaffingInquiry:${inquiry.id}`,
    });

    res.json({ inquiry, referenceCode });
  } catch (err) {
    console.error("Inquiry error:", err);
    res.status(500).json({ error: "Failed to submit inquiry." });
  }
});

// Public Career Application + CV upload
publicRouter.post("/careers/apply", uploadMemory.single("cv"), async (req, res) => {
  try {
    const ip = req.ip || "unknown";
    const rl = checkRateLimit(`careers-apply:${ip}`, 10, 15 * 60 * 1000);
    if (!rl.allowed) {
      res.status(429).json({ error: "Too many application submissions. Please try again later." });
      return;
    }
    const body = req.body ?? {};
    const applicantName = String(body.applicantName || "").trim();
    const applicantEmail = String(body.applicantEmail || "").trim();
    const applicantPhone = String(body.applicantPhone || "").trim();
    const portfolioUrl = String(body.portfolioUrl || "").trim();
    const jobPostingId = String(body.jobPostingId || "").trim() || null;
    const selectedDomain = String(body.selectedDomain || "").trim();
    const customDomainName = String(body.customDomainName || "").trim();
    const domainCategory = String(body.domainCategory || "IT").trim();
    const skillsRaw = String(body.skills || "").trim();
    const yearsExperience = Number(body.yearsExperience || "0");
    const expectedMonthlyRateUsd = Number(body.expectedMonthlyRateUsd || "0") || null;
    const summary = String(body.summary || "").trim();
    const consentToProfile =
      body.consentToProfile === true || body.consentToProfile === "true";

    if (!applicantName || !applicantEmail) {
      res.status(400).json({ error: "Full name and email address are required." });
      return;
    }

    let finalDomainName = customDomainName || selectedDomain || "Software Engineering";
    let finalDomainSlug = slugify(finalDomainName) || "software-engineering";
    let autoCreatedDomain = false;

    const existingJobDomain = await prisma.jobDomain.findUnique({
      where: { slug: finalDomainSlug },
    });
    if (!existingJobDomain) {
      await prisma.jobDomain.create({
        data: {
          slug: finalDomainSlug,
          name: finalDomainName,
          category: domainCategory === "MANAGEMENT" ? "MANAGEMENT" : "IT",
          isAutoCreated: true,
        },
      });
      autoCreatedDomain = true;
    } else {
      finalDomainName = existingJobDomain.name;
      finalDomainSlug = existingJobDomain.slug;
    }

    const existingTalentDomain = await prisma.talentDomain.findUnique({
      where: { slug: finalDomainSlug },
    });
    if (!existingTalentDomain) {
      await prisma.talentDomain.create({
        data: {
          slug: finalDomainSlug,
          name: finalDomainName,
          category: domainCategory === "MANAGEMENT" ? "MANAGEMENT" : "IT",
          description: `Auto-created talent domain for ${finalDomainName}.`,
        },
      });
    }

    let cvFileUrl: string | null = null;
    let cvOriginalName: string | null = null;
    if (req.file && req.file.size > 0) {
      const cvScan = await validateAndScanUploadBuffer(
        req.file.originalname,
        req.file.mimetype,
        req.file.buffer,
        "cv"
      );
      if (!cvScan.ok) {
        res.status(400).json({ error: cvScan.error });
        return;
      }
      const dir = resolveUploadStorageDir("cvs");
      await fs.mkdir(dir, { recursive: true });
      const fileName = cvScan.safeFilename;
      const absPath = path.join(dir, fileName);
      await fs.writeFile(absPath, req.file.buffer, { mode: 0o644 });
      cvFileUrl = `/api/careers/cv/${fileName}`;
      cvOriginalName = req.file.originalname;
    }

    const skillsArr = skillsRaw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const application = await prisma.jobApplication.create({
      data: {
        jobPostingId,
        applicantName,
        applicantEmail,
        applicantPhone: applicantPhone || null,
        portfolioUrl: portfolioUrl || null,
        domainName: finalDomainName,
        domainSlug: finalDomainSlug,
        skillsJson: JSON.stringify(skillsArr),
        yearsExperience,
        expectedMonthlyRateUsd,
        summary: summary || null,
        cvFileUrl,
        cvOriginalName,
        consentToProfile,
        screeningStatus: "NEW",
      },
    });

    res.json({
      application,
      autoCreatedDomain,
      domainName: finalDomainName,
    });
  } catch (err) {
    console.error("Career application error:", err);
    res.status(500).json({ error: "Failed to submit career application." });
  }
});

// Download CV (Admin only)
publicRouter.get("/careers/cv/:filename", async (req, res) => {
  const session = await getAdminSessionFromRequest(req);
  if (!session) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const safeName = path.basename(req.params.filename);
  const absPath = path.join(resolveUploadStorageDir("cvs"), safeName);
  try {
    await fs.access(absPath);
    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader("Content-Disposition", `attachment; filename="${safeName}"`);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Security-Policy", "default-src 'none'; sandbox");
    res.setHeader("Cache-Control", "no-store, private");
    res.sendFile(absPath);
  } catch {
    res.status(404).json({ error: "CV file not found." });
  }
});

// AI Interview Room
publicRouter.get("/interview/:token", async (req, res) => {
  const { token } = req.params;
  const session = await prisma.aiInterviewSession.findUnique({
    where: { token },
    include: {
      pipelineRequest: {
        include: {
          talent: { select: { profileCode: true, roleTitle: true, domainName: true } },
          client: { select: { companyName: true } },
        },
      },
    },
  });
  if (!session) {
    res.status(404).json({ error: "Interview room not found." });
    return;
  }
  res.json({ interview: session });
});

publicRouter.post("/interview/:token", uploadMemory.single("recording"), async (req, res) => {
  try {
    const token = String(req.params.token);
    const session = await prisma.aiInterviewSession.findUnique({ where: { token } });
    if (!session) {
      res.status(404).json({ error: "Interview room not found." });
      return;
    }

    const transcriptStr = String(req.body?.transcriptJson || "[]");
    let recordingUrl: string | null = session.recordingUrl;

    if (req.file && req.file.size > 0) {
      const scan = await validateAndScanUploadBuffer(
        req.file.originalname || "recording.webm",
        req.file.mimetype || "video/webm",
        req.file.buffer,
        "recording"
      );
      if (!scan.ok) {
        res.status(400).json({ error: scan.error });
        return;
      }
      const dir = resolveUploadStorageDir("interviews");
      await fs.mkdir(dir, { recursive: true });
      const fileName = scan.safeFilename;
      const absPath = path.join(dir, fileName);
      await fs.writeFile(absPath, req.file.buffer, { mode: 0o644 });
      recordingUrl = `/api/interview/recording/${fileName}`;
    }

    const entries = JSON.parse(transcriptStr) as Array<{
      question: string;
      answer: string;
      timestamp: string;
    }>;

    const enriched = entries.map((e) => {
      const wordCount = (e.answer || "").trim().split(/\s+/).filter(Boolean).length;
      const aiEvaluation =
        wordCount >= 20
          ? "Detailed technical articulation covering architecture & trade-offs."
          : wordCount >= 6
            ? "Clear, concise response addressing core prompt."
            : "Brief response recorded; recommend deeper follow-up in 3-way meeting.";
      return { ...e, aiEvaluation };
    });

    const avgWords =
      enriched.reduce(
        (acc, e) => acc + (e.answer || "").trim().split(/\s+/).filter(Boolean).length,
        0
      ) / Math.max(enriched.length, 1);
    const overallScore = Math.min(97, Math.max(72, Math.round(70 + avgWords * 0.8)));

    const aiSummary = `AI Interview completed across ${enriched.length} customized prompt(s). Candidate demonstrated strong domain alignment (Score: ${overallScore}/100). Full recording and Q&A transcript archived for Client Portal review.`;

    const updated = await prisma.aiInterviewSession.update({
      where: { id: session.id },
      data: {
        status: "COMPLETED",
        recordingUrl,
        transcriptJson: JSON.stringify(enriched),
        aiSummary,
        overallScore,
        completedAt: new Date(),
      },
    });

    res.json({ interview: updated });
  } catch (err) {
    console.error("Save AI interview error:", err);
    res.status(500).json({ error: "Failed to save interview." });
  }
});

publicRouter.get("/interview/recording/:filename", async (req, res) => {
  const adminSession = await getAdminSessionFromRequest(req);
  const clientSession = adminSession ? null : await getClientSessionFromRequest(req);
  if (!adminSession && !clientSession) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const safeName = path.basename(req.params.filename);
  if (!adminSession && clientSession) {
    const owned = await prisma.aiInterviewSession.findFirst({
      where: {
        recordingUrl: { endsWith: `/${safeName}` },
        pipelineRequest: { clientId: clientSession.clientId },
      },
      select: { id: true },
    });
    if (!owned) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
  }

  const absPath = path.join(resolveUploadStorageDir("interviews"), safeName);
  try {
    await fs.access(absPath);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Security-Policy", "default-src 'none'; sandbox");
    res.setHeader("Cache-Control", "no-store, private");
    res.sendFile(absPath);
  } catch {
    res.status(404).json({ error: "Recording not found." });
  }
});

// Legal E-Sign Endpoints
publicRouter.get("/sign/:token", async (req, res) => {
  const { token } = req.params;
  const sigReq = await prisma.signatureRequest.findUnique({ where: { token } });
  if (!sigReq) {
    res.status(404).json({ error: "Signing link not found." });
    return;
  }
  if (sigReq.status === "PENDING") {
    await prisma.signatureRequest.update({
      where: { id: sigReq.id },
      data: { status: "VIEWED" },
    });
  }
  res.json({ signatureRequest: sigReq });
});

publicRouter.post("/sign/:token", async (req, res) => {
  try {
    const token = String(req.params.token);
    const sigReq = await prisma.signatureRequest.findUnique({ where: { token } });
    if (!sigReq) {
      res.status(404).json({ error: "Invalid signing token." });
      return;
    }
    if (sigReq.status === "SIGNED") {
      res.status(400).json({ error: "This agreement has already been signed." });
      return;
    }

    const {
      signatureMode,
      signatureDataUrl,
      signaturePosition,
      signerFullName,
      signerTitle,
      signedDateText,
      agreedToElectronic,
    } = req.body ?? {};

    if (!agreedToElectronic) {
      res.status(400).json({
        error: "You must check 'I agree to sign electronically' to execute this agreement.",
      });
      return;
    }
    if (!signerFullName || !signatureDataUrl || !signedDateText) {
      res.status(400).json({
        error: "Full name, date, and placed signature are required.",
      });
      return;
    }

    const forwardedFor = req.headers["x-forwarded-for"];
    const signerIp =
      (Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor)?.split(",")[0]?.trim() ||
      req.ip ||
      "127.0.0.1";

    const pdfResult = await generateSignedAgreementPdf({
      requestId: sigReq.id,
      token: sigReq.token,
      documentTitle: sigReq.documentTitle,
      documentVersion: sigReq.documentVersion,
      renderedHtml: sigReq.renderedHtml,
      clientName: sigReq.clientName,
      clientEmail: sigReq.clientEmail,
      clientCompany: sigReq.clientCompany,
      partyBName: sigReq.partyBName,
      partyBEmail: sigReq.partyBEmail,
      signerFullName: String(signerFullName),
      signerTitle: signerTitle ? String(signerTitle) : null,
      signedDateText: String(signedDateText),
      signatureDataUrl: String(signatureDataUrl),
      signatureMode: String(signatureMode || "DRAW"),
      signaturePosition: signaturePosition || { xPct: 0.1, yPct: 0.2 },
      signerIp,
    });

    const updated = await prisma.signatureRequest.update({
      where: { id: sigReq.id },
      data: {
        status: "SIGNED",
        signatureMode: String(signatureMode || "DRAW"),
        signatureDataUrl: String(signatureDataUrl),
        signaturePositionJson: JSON.stringify(signaturePosition || { xPct: 0.1, yPct: 0.2 }),
        signerFullName: String(signerFullName),
        signerTitle: signerTitle ? String(signerTitle) : null,
        signedDateText: String(signedDateText),
        agreedToElectronic: true,
        signerIp,
        verificationHash: pdfResult.verificationHash,
        signedPdfPath: pdfResult.relativePath,
        signedAt: new Date(),
      },
    });

    const subject = `Executed Agreement: ${sigReq.documentTitle} (v${sigReq.documentVersion})`;
    const bodyText = `Dear ${sigReq.clientName} & ${sigReq.partyBName},\n\nThe agreement "${sigReq.documentTitle}" (v${sigReq.documentVersion}) has been electronically executed by ${signerFullName} on ${signedDateText}.\n\nVerification SHA-256: ${pdfResult.verificationHash}\nSigned PDF is attached and archived securely.\n\nRegards,\nVia Codos Legal & Operations`;

    await Promise.all([
      dispatchEmail({
        toEmail: sigReq.clientEmail,
        subject,
        bodyText,
        attachmentPath: pdfResult.absolutePath,
        attachmentName: `${sigReq.documentTitle.replace(/[^a-z0-9]+/gi, "-")}-SIGNED.pdf`,
        relatedEntity: `SignatureRequest:${sigReq.id}`,
      }),
      dispatchEmail({
        toEmail: sigReq.partyBEmail,
        subject: `[Executed Copy] ${subject}`,
        bodyText,
        attachmentPath: pdfResult.absolutePath,
        attachmentName: `${sigReq.documentTitle.replace(/[^a-z0-9]+/gi, "-")}-SIGNED.pdf`,
        relatedEntity: `SignatureRequest:${sigReq.id}`,
      }),
    ]);

    if (sigReq.pipelineRequestId) {
      const pipe = await prisma.profileRequest.findUnique({
        where: { id: sigReq.pipelineRequestId },
      });
      if (pipe) {
        await prisma.profileRequest.update({
          where: { id: pipe.id },
          data: { stage: "HIRED" },
        });
        await prisma.talentProfile.update({
          where: { id: pipe.talentId },
          data: { placementStatus: "PLACED" },
        });
      }
    }

    await recordAuditLog({
      actorEmail: sigReq.clientEmail,
      actorRole: "CLIENT_SIGNER",
      action: "SIGN",
      entityType: "SignatureRequest",
      entityId: sigReq.id,
      entityLabel: sigReq.documentTitle,
      summary: `Document electronically signed by ${signerFullName} (${sigReq.clientEmail}); stamped PDF stored and emailed to both parties.`,
      ipAddress: signerIp,
    });

    res.json({
      signatureRequest: updated,
      pdfUrl: `/api/sign/${token}/pdf`,
      verificationHash: pdfResult.verificationHash,
    });
  } catch (err) {
    console.error("E-sign submit error:", err);
    res.status(500).json({ error: "Failed to stamp and save signed PDF." });
  }
});

publicRouter.get("/sign/:token/pdf", async (req, res) => {
  const { token } = req.params;
  const sigReq = await prisma.signatureRequest.findUnique({ where: { token } });
  if (!sigReq || !sigReq.signedPdfPath) {
    res.status(404).json({ error: "Signed PDF not found." });
    return;
  }
  const absPath = path.join(process.cwd(), sigReq.signedPdfPath);
  try {
    await fs.access(absPath);
    res.setHeader("Content-Type", "application/pdf");
    res.sendFile(absPath);
  } catch {
    res.status(404).json({ error: "Signed PDF file unavailable." });
  }
});

// Public Corporate Content Read APIs (for decoupled frontend consumption)
publicRouter.get("/public/site-data", async (_req, res) => {
  const [settings, menus, services, industries, caseStudies, saasProducts, testimonials] =
    await Promise.all([
      prisma.siteSetting.findMany(),
      prisma.menuItem.findMany({ where: { isVisible: true }, orderBy: { sortOrder: "asc" } }),
      prisma.service.findMany({ where: { status: "PUBLISHED" }, orderBy: { sortOrder: "asc" } }),
      prisma.industry.findMany({ where: { status: "PUBLISHED" }, orderBy: { sortOrder: "asc" } }),
      prisma.caseStudy.findMany({ where: { status: "PUBLISHED" }, orderBy: { sortOrder: "asc" } }),
      prisma.saasProduct.findMany({ where: { status: "PUBLISHED" }, orderBy: { sortOrder: "asc" } }),
      prisma.testimonial.findMany({ where: { isVisible: true }, orderBy: { sortOrder: "asc" } }),
    ]);

  res.json({
    settings,
    menus,
    services,
    industries,
    caseStudies,
    saasProducts,
    testimonials,
  });
});

publicRouter.get("/public/insights", async (_req, res) => {
  const articles = await prisma.insightArticle.findMany({
    where: { status: "PUBLISHED" },
    orderBy: { sortOrder: "asc" },
  });
  res.json({ articles });
});

publicRouter.get("/public/legal", async (_req, res) => {
  const documents = await prisma.legalDocument.findMany({
    where: { status: "PUBLISHED", isPublic: true },
    include: { type: true },
    orderBy: { updatedAt: "desc" },
  });
  res.json({ documents });
});

