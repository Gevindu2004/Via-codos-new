import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { Router } from "express";
import multer from "multer";
import { prisma } from "../lib/prisma";
import { hasAdminRole } from "../lib/auth";
import { recordAuditLog, saveContentVersion } from "../lib/audit";
import { dispatchEmail } from "../lib/email";
import { slugify } from "../lib/sanitize";
import { escapeHtml, resolveUploadStorageDir, sanitizeRichHtml, validateAndScanUploadBuffer } from "../lib/security";
import { requireAdmin, type AuthenticatedRequest } from "../middleware/auth";

export const adminRouter = Router();

adminRouter.use("/admin", requireAdmin);

const mediaUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

// 1. Pipeline & Client Verification
adminRouter.get("/admin/pipeline", async (req: AuthenticatedRequest, res) => {
  if (!hasAdminRole(req.adminSession!, ["SUPER_ADMIN", "RECRUITER"])) {
    res.status(403).json({ error: "Insufficient role permissions for pipeline access." });
    return;
  }
  const [clients, requests, inquiries] = await Promise.all([
    prisma.clientUser.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.profileRequest.findMany({
      include: {
        client: {
          select: { id: true, name: true, email: true, companyName: true, verificationStatus: true },
        },
        talent: {
          select: {
            id: true,
            profileCode: true,
            displayName: true,
            roleTitle: true,
            domainName: true,
            placementStatus: true,
            monthlyRateUsd: true,
          },
        },
        interviews: true,
        meetings: true,
      },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.staffingInquiry.findMany({ orderBy: { createdAt: "desc" } }),
  ]);

  res.json({ clients, requests, inquiries });
});

adminRouter.post("/admin/pipeline", async (req: AuthenticatedRequest, res) => {
  const session = req.adminSession!;
  if (!hasAdminRole(session, ["SUPER_ADMIN", "RECRUITER"])) {
    res.status(403).json({ error: "Insufficient role permissions for pipeline updates." });
    return;
  }
  try {
    const body = req.body ?? {};
    const { action } = body;

    if (action === "VERIFY_CLIENT") {
      const updated = await prisma.clientUser.update({
        where: { id: body.clientId },
        data: {
          verificationStatus: body.status,
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
      res.json({ client: updated });
      return;
    }

    if (action === "APPROVE_PROFILE_REQUEST") {
      const pipe = await prisma.profileRequest.findUnique({
        where: { id: body.requestId },
        include: { client: true, talent: true },
      });
      if (!pipe) {
        res.status(404).json({ error: "Request not found." });
        return;
      }

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
          adminApprovalNotes:
            body.notes || "Approved for full anonymized dossier release and AI interview scheduling.",
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
      res.json({ request: updated });
      return;
    }

    if (action === "UPDATE_INQUIRY_STATUS") {
      const updated = await prisma.staffingInquiry.update({
        where: { id: body.inquiryId },
        data: { status: body.status },
      });
      res.json({ inquiry: updated });
      return;
    }

    if (action === "MARK_PLACED") {
      const pipe = await prisma.profileRequest.findUnique({ where: { id: body.requestId } });
      if (!pipe) {
        res.status(404).json({ error: "Request not found." });
        return;
      }
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
      res.json({ ok: true });
      return;
    }

    res.status(400).json({ error: "Unknown action." });
  } catch (err) {
    console.error("Admin pipeline error:", err);
    res.status(500).json({ error: "Pipeline action failed." });
  }
});

// 2. Careers & Applicant Conversion
adminRouter.get("/admin/careers", async (req: AuthenticatedRequest, res) => {
  if (!hasAdminRole(req.adminSession!, ["SUPER_ADMIN", "RECRUITER"])) {
    res.status(403).json({ error: "Insufficient role permissions for careers access." });
    return;
  }
  const [domains, postings, applications, sampleProfiles] = await Promise.all([
    prisma.jobDomain.findMany({ orderBy: { name: "asc" } }),
    prisma.jobPosting.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.jobApplication.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.talentProfile.findMany({
      where: { visibilityFlag: "SAMPLE", status: "PUBLISHED" },
      orderBy: { profileCode: "asc" },
    }),
  ]);

  res.json({ domains, postings, applications, sampleProfiles });
});

adminRouter.post("/admin/careers", async (req: AuthenticatedRequest, res) => {
  const session = req.adminSession!;
  if (!hasAdminRole(session, ["SUPER_ADMIN", "RECRUITER"])) {
    res.status(403).json({ error: "Insufficient role permissions for careers management." });
    return;
  }
  try {
    const body = req.body ?? {};
    const { action } = body;

    if (action === "CREATE_DOMAIN") {
      const slug = slugify(body.name);
      const domain = await prisma.jobDomain.upsert({
        where: { slug },
        update: { name: body.name, category: body.category || "IT" },
        create: { slug, name: body.name, category: body.category || "IT", isAutoCreated: false },
      });
      await prisma.talentDomain.upsert({
        where: { slug },
        update: { name: body.name, category: body.category || "IT" },
        create: { slug, name: body.name, category: body.category || "IT" },
      });
      await recordAuditLog({
        actorId: session.userId,
        actorEmail: session.email,
        actorRole: session.role,
        action: "CREATE",
        entityType: "JobDomain",
        entityId: domain.id,
        entityLabel: domain.name,
        summary: `Added job & talent domain "${domain.name}"`,
      });
      res.json({ domain });
      return;
    }

    if (action === "CREATE_JOB") {
      const dom = await prisma.jobDomain.findUnique({ where: { slug: body.domainSlug } });
      const job = await prisma.jobPosting.create({
        data: {
          title: body.title,
          domainId: dom?.id || null,
          domainSlug: body.domainSlug,
          domainName: dom?.name || body.domainName || body.domainSlug,
          employmentType: body.employmentType || "Full-time",
          location: body.location || "Remote",
          experienceRequired: body.experienceRequired || "3+ years experience",
          skillsJson: JSON.stringify(body.skills || []),
          responsibilitiesJson: JSON.stringify(body.responsibilities || []),
          status: "PUBLISHED",
        },
      });
      await recordAuditLog({
        actorId: session.userId,
        actorEmail: session.email,
        actorRole: session.role,
        action: "CREATE",
        entityType: "JobPosting",
        entityId: job.id,
        entityLabel: job.title,
        summary: `Published open role "${job.title}"`,
      });
      res.json({ job });
      return;
    }

    if (action === "UPDATE_SCREENING") {
      const app = await prisma.jobApplication.update({
        where: { id: body.applicationId },
        data: {
          screeningStatus: body.screeningStatus,
          screeningNotes: body.screeningNotes || null,
        },
      });
      res.json({ application: app });
      return;
    }

    if (action === "CONVERT_TO_PROFILE") {
      const app = await prisma.jobApplication.findUnique({ where: { id: body.applicationId } });
      if (!app) {
        res.status(404).json({ error: "Application not found." });
        return;
      }
      if (!app.consentToProfile) {
        res.status(400).json({
          error: "Applicant did not grant consent for anonymized profile publishing.",
        });
        return;
      }

      const dom = await prisma.jobDomain.findUnique({ where: { slug: app.domainSlug } });
      const category = dom?.category === "MANAGEMENT" ? "MANAGEMENT" : "IT";
      const prefix = category === "MANAGEMENT" ? "VC-MG" : "VC-IT";
      const randomNum = Math.floor(300 + Math.random() * 699);
      const profileCode = `${prefix}-${randomNum}`;

      const monthlyRate = Number(body.monthlyRateUsd || app.expectedMonthlyRateUsd || 4500);
      const hourlyRate = Math.max(12, Math.round(monthlyRate / 160));

      const newProfile = await prisma.talentProfile.create({
        data: {
          profileCode,
          displayName: app.applicantName,
          category,
          domainSlug: app.domainSlug,
          domainName: app.domainName,
          roleTitle: String(body.roleTitle || `${app.domainName} Specialist`),
          summary: String(
            body.anonymizedSummary ||
              app.summary ||
              `${app.yearsExperience}+ years vetted specialist in ${app.domainName}.`
          ),
          skillsJson: app.skillsJson,
          yearsExperience: app.yearsExperience,
          projectsJson: JSON.stringify([
            {
              title: `${app.domainName} Production Engagement`,
              scope: `Verified track record across ${app.yearsExperience} years of commercial delivery.`,
              outcome: "Screened and approved through Via Codos 4-stage vetting.",
              stack: JSON.parse(app.skillsJson).slice(0, 4),
            },
          ]),
          industriesJson: JSON.stringify(["External IT Sector", "Mid & Small Business"]),
          availability: "IMMEDIATE",
          hourlyRateUsd: hourlyRate,
          monthlyRateUsd: monthlyRate,
          visibilityFlag: "REAL",
          placementStatus: "AVAILABLE",
          internalCandidateId: app.id,
          status: "PUBLISHED",
        },
      });

      if (body.replaceSampleProfileId) {
        await prisma.talentProfile.update({
          where: { id: body.replaceSampleProfileId },
          data: { status: "ARCHIVED" },
        });
      }

      await prisma.jobApplication.update({
        where: { id: app.id },
        data: {
          screeningStatus: "CONVERTED",
          convertedProfileId: newProfile.id,
          replacedSampleProfileId: body.replaceSampleProfileId || null,
        },
      });

      await recordAuditLog({
        actorId: session.userId,
        actorEmail: session.email,
        actorRole: session.role,
        action: "CONVERT_APPLICANT",
        entityType: "TalentProfile",
        entityId: newProfile.id,
        entityLabel: newProfile.profileCode,
        summary: `Converted consented applicant into live REAL anonymized profile ${newProfile.profileCode}${
          body.replaceSampleProfileId ? " (replaced sample profile)" : ""
        }.`,
      });

      res.json({ profile: newProfile });
      return;
    }

    res.status(400).json({ error: "Unknown career action." });
  } catch (err) {
    console.error("Admin careers error:", err);
    res.status(500).json({ error: "Careers operation failed." });
  }
});

// 3. Legal Documents & E-Sign Links
adminRouter.get("/admin/legal", async (req: AuthenticatedRequest, res) => {
  if (!hasAdminRole(req.adminSession!, ["SUPER_ADMIN", "LEGAL_ADMIN"])) {
    res.status(403).json({ error: "Insufficient role permissions for legal records." });
    return;
  }
  const [types, documents, signatureRequests] = await Promise.all([
    prisma.legalDocumentType.findMany({ orderBy: { name: "asc" } }),
    prisma.legalDocument.findMany({ include: { type: true }, orderBy: { updatedAt: "desc" } }),
    prisma.signatureRequest.findMany({ orderBy: { createdAt: "desc" }, take: 50 }),
  ]);

  res.json({ types, documents, signatureRequests });
});

adminRouter.post("/admin/legal", async (req: AuthenticatedRequest, res) => {
  const session = req.adminSession!;
  if (!hasAdminRole(session, ["SUPER_ADMIN", "LEGAL_ADMIN"])) {
    res.status(403).json({ error: "Insufficient role permissions for legal management." });
    return;
  }
  try {
    const body = req.body ?? {};
    const { action } = body;

    if (action === "CREATE_TYPE") {
      const slug = slugify(body.slug || body.name);
      const created = await prisma.legalDocumentType.create({
        data: {
          slug,
          name: body.name,
          description: body.description || null,
          isPublicPolicy: Boolean(body.isPublicPolicy),
          isPrivateTemplate: Boolean(body.isPrivateTemplate),
        },
      });
      await recordAuditLog({
        actorId: session.userId,
        actorEmail: session.email,
        actorRole: session.role,
        action: "CREATE",
        entityType: "LegalDocumentType",
        entityId: created.id,
        entityLabel: created.name,
        summary: `Created new legal document type "${created.name}"`,
      });
      res.json({ type: created });
      return;
    }

    if (action === "SAVE_DOC") {
      const slug = slugify(body.slug || body.title);
      const saved = body.id
        ? await prisma.legalDocument.update({
            where: { id: body.id },
            data: {
              typeId: body.typeId,
              slug,
              title: body.title,
              version: body.version || "1.0",
              effectiveDate: new Date(body.effectiveDate || Date.now()),
              summary: body.summary || null,
              contentHtml: body.contentHtml,
              status: body.status || "PUBLISHED",
              isPublic: Boolean(body.isPublic),
              isTemplate: Boolean(body.isTemplate),
              updatedBy: session.email,
            },
          })
        : await prisma.legalDocument.create({
            data: {
              typeId: body.typeId,
              slug,
              title: body.title,
              version: body.version || "1.0",
              effectiveDate: new Date(body.effectiveDate || Date.now()),
              summary: body.summary || null,
              contentHtml: body.contentHtml,
              status: body.status || "PUBLISHED",
              isPublic: Boolean(body.isPublic),
              isTemplate: Boolean(body.isTemplate),
              updatedBy: session.email,
            },
          });

      await saveContentVersion({
        entityType: "LegalDocument",
        entityId: saved.id,
        snapshot: saved,
        changeNote: `Legal v${saved.version} (${saved.status})`,
        createdByEmail: session.email,
      });

      await recordAuditLog({
        actorId: session.userId,
        actorEmail: session.email,
        actorRole: session.role,
        action: body.id ? "UPDATE" : "CREATE",
        entityType: "LegalDocument",
        entityId: saved.id,
        entityLabel: saved.title,
        summary: `${body.id ? "Updated" : "Created"} legal document "${saved.title}" v${saved.version}`,
      });

      res.json({ document: saved });
      return;
    }

    if (action === "GENERATE_SIGN_LINK") {
      const doc = await prisma.legalDocument.findUnique({ where: { id: body.documentId } });
      if (!doc) {
        res.status(404).json({ error: "Document not found." });
        return;
      }

      const effectiveDate = new Date().toISOString().slice(0, 10);
      const renderedHtml = sanitizeRichHtml(
        doc.contentHtml
          .replace(/\{\{effectiveDate\}\}/g, escapeHtml(effectiveDate))
          .replace(/\{\{clientName\}\}/g, escapeHtml(body.clientName))
          .replace(/\{\{clientEmail\}\}/g, escapeHtml(body.clientEmail))
          .replace(/\{\{clientCompany\}\}/g, escapeHtml(body.clientCompany || body.clientName))
          .replace(/\{\{profileCode\}\}/g, escapeHtml(body.profileCode || "N/A"))
          .replace(/\{\{roleTitle\}\}/g, escapeHtml(body.roleTitle || "Agreed Services"))
          .replace(/\{\{monthlyRateUsd\}\}/g, escapeHtml(String(body.monthlyRateUsd || "Agreed")))
      );

      const token = `sign-${crypto.randomBytes(10).toString("hex")}`;
      const sigReq = await prisma.signatureRequest.create({
        data: {
          token,
          documentId: doc.id,
          documentTitle: doc.title,
          documentVersion: doc.version,
          renderedHtml,
          clientName: body.clientName,
          clientEmail: body.clientEmail,
          clientCompany: body.clientCompany || null,
          createdBy: session.email,
        },
      });

      const signUrl = `/sign/${token}`;

      await dispatchEmail({
        toEmail: body.clientEmail,
        subject: `Signature Requested: ${doc.title} — Via Codos`,
        bodyText: `Dear ${body.clientName},\n\nPlease review and electronically sign "${doc.title}" (v${doc.version}) at:\n${process.env.PUBLIC_APP_URL || "http://localhost:3000"}${signUrl}\n\nRegards,\nVia Codos Legal`,
        relatedEntity: `SignatureRequest:${sigReq.id}`,
      });

      await recordAuditLog({
        actorId: session.userId,
        actorEmail: session.email,
        actorRole: session.role,
        action: "GENERATE_SIGN_LINK",
        entityType: "SignatureRequest",
        entityId: sigReq.id,
        entityLabel: `${doc.title} -> ${body.clientEmail}`,
        summary: `Generated e-sign link for "${doc.title}" sent to ${body.clientEmail}`,
      });

      res.json({ signatureRequest: sigReq, signUrl });
      return;
    }

    res.status(400).json({ error: "Invalid legal action." });
  } catch (err) {
    console.error("Admin legal error:", err);
    res.status(500).json({ error: "Legal operation failed." });
  }
});

// 4. Audit & Email Outbox
adminRouter.get("/admin/audit", async (req: AuthenticatedRequest, res) => {
  if (!hasAdminRole(req.adminSession!, ["SUPER_ADMIN", "LEGAL_ADMIN"])) {
    res.status(403).json({ error: "Insufficient role permissions for audit records." });
    return;
  }
  const [auditLogs, emails] = await Promise.all([
    prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.emailOutbox.findMany({ orderBy: { createdAt: "desc" }, take: 50 }),
  ]);
  res.json({ auditLogs, emails });
});

// 5. Content Versions & Rollback
adminRouter.get("/admin/versions", async (req: AuthenticatedRequest, res) => {
  if (!hasAdminRole(req.adminSession!, ["SUPER_ADMIN", "CONTENT_EDITOR", "LEGAL_ADMIN"])) {
    res.status(403).json({ error: "Insufficient role permissions for version history." });
    return;
  }
  const entityType = typeof req.query.entityType === "string" ? req.query.entityType : undefined;
  const entityId = typeof req.query.entityId === "string" ? req.query.entityId : undefined;

  const versions = await prisma.contentVersion.findMany({
    where: {
      ...(entityType ? { entityType } : {}),
      ...(entityId ? { entityId } : {}),
    },
    orderBy: [{ createdAt: "desc" }],
    take: 50,
  });

  res.json({ versions });
});

adminRouter.post("/admin/versions", async (req: AuthenticatedRequest, res) => {
  const session = req.adminSession!;
  if (!hasAdminRole(session, ["SUPER_ADMIN", "CONTENT_EDITOR", "LEGAL_ADMIN"])) {
    res.status(403).json({ error: "Insufficient role permissions for content rollback." });
    return;
  }
  try {
    const { versionId } = req.body ?? {};
    const version = await prisma.contentVersion.findUnique({ where: { id: String(versionId) } });
    if (!version) {
      res.status(404).json({ error: "Version not found." });
      return;
    }

    const snap = JSON.parse(version.snapshotJson) as Record<string, unknown>;
    const { entityType, entityId } = version;

    if (entityType === "Service") {
      await prisma.service.update({
        where: { id: entityId },
        data: {
          name: String(snap.name),
          tagline: String(snap.tagline),
          oneliner: String(snap.oneliner),
          bodyJson: String(snap.bodyJson),
          includedJson: String(snap.includedJson),
          statValue: String(snap.statValue),
          statLabel: String(snap.statLabel),
          status: String(snap.status || "PUBLISHED"),
        },
      });
    } else if (entityType === "Industry") {
      await prisma.industry.update({
        where: { id: entityId },
        data: {
          name: String(snap.name),
          intro: String(snap.intro),
          challengesJson: String(snap.challengesJson),
          solutionsJson: String(snap.solutionsJson),
          status: String(snap.status || "PUBLISHED"),
        },
      });
    } else if (entityType === "CaseStudy") {
      await prisma.caseStudy.update({
        where: { id: entityId },
        data: {
          name: String(snap.name),
          headline: String(snap.headline),
          challenge: String(snap.challenge),
          solution: String(snap.solution),
          quote: String(snap.quote),
          status: String(snap.status || "PUBLISHED"),
        },
      });
    } else if (entityType === "InsightArticle") {
      await prisma.insightArticle.update({
        where: { id: entityId },
        data: {
          title: String(snap.title),
          category: String(snap.category),
          excerpt: String(snap.excerpt),
          bodyHtml: String(snap.bodyHtml),
          status: String(snap.status || "PUBLISHED"),
        },
      });
    } else if (entityType === "SaasProduct") {
      await prisma.saasProduct.update({
        where: { id: entityId },
        data: {
          name: String(snap.name),
          tagline: String(snap.tagline),
          summary: String(snap.summary),
          descriptionHtml: String(snap.descriptionHtml),
          consolePath: String(snap.consolePath),
          externalConsoleUrl: snap.externalConsoleUrl ? String(snap.externalConsoleUrl) : null,
          status: String(snap.status || "PUBLISHED"),
        },
      });
    } else if (entityType === "LegalDocument") {
      await prisma.legalDocument.update({
        where: { id: entityId },
        data: {
          title: String(snap.title),
          version: String(snap.version),
          summary: snap.summary ? String(snap.summary) : null,
          contentHtml: String(snap.contentHtml),
          status: String(snap.status || "PUBLISHED"),
          updatedBy: session.email,
        },
      });
    } else if (entityType === "CmsPage") {
      await prisma.cmsPage.update({
        where: { id: entityId },
        data: {
          title: String(snap.title),
          subtitle: snap.subtitle ? String(snap.subtitle) : null,
          status: String(snap.status || "PUBLISHED"),
          updatedBy: session.email,
        },
      });
    }

    await saveContentVersion({
      entityType,
      entityId,
      snapshot: snap,
      changeNote: `Rollback to v${version.versionNumber}`,
      createdByEmail: session.email,
    });

    await recordAuditLog({
      actorId: session.userId,
      actorEmail: session.email,
      actorRole: session.role,
      action: "ROLLBACK",
      entityType,
      entityId,
      entityLabel: `${entityType}:${entityId}`,
      summary: `Rolled back ${entityType} (${entityId}) to version #${version.versionNumber}`,
      after: snap,
    });

    res.json({ ok: true, restoredVersion: version.versionNumber });
  } catch (err) {
    console.error("Rollback error:", err);
    res.status(500).json({ error: "Failed to rollback version." });
  }
});

// 6. Media Upload
adminRouter.post("/admin/upload", mediaUpload.single("file"), async (req: AuthenticatedRequest, res) => {
  const session = req.adminSession!;
  if (!hasAdminRole(session, ["SUPER_ADMIN", "CONTENT_EDITOR"])) {
    res.status(403).json({ error: "Insufficient role permissions for uploads." });
    return;
  }
  try {
    const file = req.file;
    const altText = String(req.body?.altText || "").trim();
    const folder = String(req.body?.folder || "general").trim();

    if (!file || file.size === 0) {
      res.status(400).json({ error: "File is required." });
      return;
    }

    const scan = await validateAndScanUploadBuffer(file.originalname, file.mimetype, file.buffer, "media");
    if (!scan.ok) {
      res.status(400).json({ error: scan.error });
      return;
    }

    const dir = resolveUploadStorageDir("uploads");
    await fs.mkdir(dir, { recursive: true });
    const filename = scan.safeFilename;
    const absPath = path.join(dir, filename);

    await fs.writeFile(absPath, file.buffer, { mode: 0o644 });

    const asset = await prisma.mediaAsset.create({
      data: {
        filename,
        originalName: file.originalname,
        mimeType: scan.mimeType,
        sizeBytes: file.buffer.length,
        url: `/api/media/${filename}`,
        altText: altText || file.originalname,
        folder,
        uploadedBy: session.email,
      },
    });

    await recordAuditLog({
      actorId: session.userId,
      actorEmail: session.email,
      actorRole: session.role,
      action: "UPLOAD_MEDIA",
      entityType: "MediaAsset",
      entityId: asset.id,
      entityLabel: asset.originalName,
      summary: `Uploaded media asset ${asset.originalName} (${asset.url})`,
    });

    res.json({ asset });
  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).json({ error: "Failed to upload file." });
  }
});

// 7. CMS Content CRUD
adminRouter.get("/admin/content", async (req: AuthenticatedRequest, res) => {
  if (!hasAdminRole(req.adminSession!, ["SUPER_ADMIN", "CONTENT_EDITOR"])) {
    res.status(403).json({ error: "Insufficient role permissions." });
    return;
  }
  const [
    pages,
    categories,
    menus,
    settings,
    services,
    industries,
    caseStudies,
    insights,
    saasProducts,
    media,
  ] = await Promise.all([
    prisma.cmsPage.findMany({
      include: { category: true, sections: { orderBy: { sortOrder: "asc" } } },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.category.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.menuItem.findMany({ orderBy: [{ location: "asc" }, { sortOrder: "asc" }] }),
    prisma.siteSetting.findMany(),
    prisma.service.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.industry.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.caseStudy.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.insightArticle.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.saasProduct.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.mediaAsset.findMany({ orderBy: { createdAt: "desc" } }),
  ]);

  res.json({
    pages,
    categories,
    menus,
    settings,
    services,
    industries,
    caseStudies,
    insights,
    saasProducts,
    media,
  });
});

adminRouter.post("/admin/content", async (req: AuthenticatedRequest, res) => {
  const session = req.adminSession!;
  if (!hasAdminRole(session, ["SUPER_ADMIN", "CONTENT_EDITOR"])) {
    res.status(403).json({ error: "Insufficient role permissions for CMS modifications." });
    return;
  }
  try {
    const { entity, action, payload } = req.body ?? {};

    if (entity === "Category") {
      if (action === "DELETE") {
        await prisma.category.delete({ where: { id: payload.id } });
        await recordAuditLog({
          actorId: session.userId,
          actorEmail: session.email,
          actorRole: session.role,
          action: "DELETE",
          entityType: "Category",
          entityId: payload.id,
          entityLabel: payload.name || payload.id,
          summary: `Deleted category ${payload.name || payload.id}`,
        });
        res.json({ ok: true });
        return;
      }
      const slug = slugify(payload.slug || payload.name);
      const saved = payload.id
        ? await prisma.category.update({
            where: { id: payload.id },
            data: { name: payload.name, slug, scope: payload.scope || "PAGE", description: payload.description || null },
          })
        : await prisma.category.create({
            data: { name: payload.name, slug, scope: payload.scope || "PAGE", description: payload.description || null },
          });
      await recordAuditLog({
        actorId: session.userId,
        actorEmail: session.email,
        actorRole: session.role,
        action: payload.id ? "UPDATE" : "CREATE",
        entityType: "Category",
        entityId: saved.id,
        entityLabel: saved.name,
        summary: `${payload.id ? "Updated" : "Created"} category ${saved.name}`,
      });
      res.json({ item: saved });
      return;
    }

    if (entity === "MenuItem") {
      if (action === "DELETE") {
        await prisma.menuItem.delete({ where: { id: payload.id } });
        await recordAuditLog({
          actorId: session.userId,
          actorEmail: session.email,
          actorRole: session.role,
          action: "DELETE",
          entityType: "MenuItem",
          entityId: payload.id,
          entityLabel: payload.label || payload.id,
          summary: `Removed menu item ${payload.label || payload.id}`,
        });
        res.json({ ok: true });
        return;
      }
      const saved = payload.id
        ? await prisma.menuItem.update({
            where: { id: payload.id },
            data: {
              location: payload.location,
              label: payload.label,
              href: payload.href,
              sortOrder: Number(payload.sortOrder || 0),
              isVisible: Boolean(payload.isVisible ?? true),
            },
          })
        : await prisma.menuItem.create({
            data: {
              location: payload.location || "HEADER",
              label: payload.label,
              href: payload.href,
              sortOrder: Number(payload.sortOrder || 0),
              isVisible: Boolean(payload.isVisible ?? true),
            },
          });
      await recordAuditLog({
        actorId: session.userId,
        actorEmail: session.email,
        actorRole: session.role,
        action: payload.id ? "UPDATE" : "CREATE",
        entityType: "MenuItem",
        entityId: saved.id,
        entityLabel: saved.label,
        summary: `${payload.id ? "Updated" : "Created"} navigation link "${saved.label}" -> ${saved.href}`,
      });
      res.json({ item: saved });
      return;
    }

    if (entity === "SiteSetting") {
      const saved = await prisma.siteSetting.upsert({
        where: { key: payload.key },
        update: { valueJson: JSON.stringify(payload.value) },
        create: { key: payload.key, valueJson: JSON.stringify(payload.value) },
      });
      await recordAuditLog({
        actorId: session.userId,
        actorEmail: session.email,
        actorRole: session.role,
        action: "UPDATE",
        entityType: "SiteSetting",
        entityId: saved.key,
        entityLabel: saved.key,
        summary: `Updated site setting "${saved.key}"`,
      });
      res.json({ item: saved });
      return;
    }

    if (entity === "CmsPage") {
      if (action === "DELETE") {
        await prisma.cmsPage.delete({ where: { id: payload.id } });
        await recordAuditLog({
          actorId: session.userId,
          actorEmail: session.email,
          actorRole: session.role,
          action: "DELETE",
          entityType: "CmsPage",
          entityId: payload.id,
          entityLabel: payload.title || payload.id,
          summary: `Deleted CMS page ${payload.title || payload.id}`,
        });
        res.json({ ok: true });
        return;
      }
      const slug = slugify(payload.slug || payload.title);
      const saved = payload.id
        ? await prisma.cmsPage.update({
            where: { id: payload.id },
            data: {
              slug,
              title: payload.title,
              subtitle: payload.subtitle || null,
              categoryId: payload.categoryId || null,
              status: payload.status || "DRAFT",
              publishedAt: payload.status === "PUBLISHED" ? new Date() : null,
              updatedBy: session.email,
            },
          })
        : await prisma.cmsPage.create({
            data: {
              slug,
              title: payload.title,
              subtitle: payload.subtitle || null,
              categoryId: payload.categoryId || null,
              status: payload.status || "PUBLISHED",
              publishedAt: payload.status !== "DRAFT" ? new Date() : null,
              updatedBy: session.email,
            },
          });

      await saveContentVersion({
        entityType: "CmsPage",
        entityId: saved.id,
        snapshot: saved,
        changeNote: payload.changeNote || `Saved page (${saved.status})`,
        createdByEmail: session.email,
      });
      await recordAuditLog({
        actorId: session.userId,
        actorEmail: session.email,
        actorRole: session.role,
        action: payload.id ? "UPDATE" : "CREATE",
        entityType: "CmsPage",
        entityId: saved.id,
        entityLabel: saved.title,
        summary: `${payload.id ? "Updated" : "Created"} page /p/${saved.slug} (${saved.status})`,
      });
      res.json({ item: saved });
      return;
    }

    if (entity === "CmsSection") {
      if (action === "DELETE") {
        await prisma.cmsSection.delete({ where: { id: payload.id } });
        res.json({ ok: true });
        return;
      }
      const saved = payload.id
        ? await prisma.cmsSection.update({
            where: { id: payload.id },
            data: {
              type: payload.type || "RICH_TEXT",
              title: payload.title || null,
              subtitle: payload.subtitle || null,
              bodyHtml: payload.bodyHtml || null,
              imageUrl: payload.imageUrl || null,
              dataJson: payload.dataJson || null,
              sortOrder: Number(payload.sortOrder || 0),
              isVisible: Boolean(payload.isVisible ?? true),
            },
          })
        : await prisma.cmsSection.create({
            data: {
              pageId: payload.pageId,
              sectionKey: slugify(payload.title || "section") + "-" + Date.now(),
              type: payload.type || "RICH_TEXT",
              title: payload.title || null,
              subtitle: payload.subtitle || null,
              bodyHtml: payload.bodyHtml || null,
              imageUrl: payload.imageUrl || null,
              dataJson: payload.dataJson || null,
              sortOrder: Number(payload.sortOrder || 1),
            },
          });
      await recordAuditLog({
        actorId: session.userId,
        actorEmail: session.email,
        actorRole: session.role,
        action: payload.id ? "UPDATE" : "CREATE",
        entityType: "CmsSection",
        entityId: saved.id,
        entityLabel: saved.title || saved.type,
        summary: `${payload.id ? "Updated" : "Added"} ${saved.type} section on page`,
      });
      res.json({ item: saved });
      return;
    }

    if (entity === "Service") {
      const saved = await prisma.service.update({
        where: { id: payload.id },
        data: {
          name: payload.name,
          tagline: payload.tagline,
          oneliner: payload.oneliner,
          bodyJson: JSON.stringify(payload.body || []),
          includedJson: JSON.stringify(payload.included || []),
          statValue: payload.statValue,
          statLabel: payload.statLabel,
          status: payload.status || "PUBLISHED",
        },
      });
      await saveContentVersion({
        entityType: "Service",
        entityId: saved.id,
        snapshot: saved,
        changeNote: payload.changeNote || `Updated service (${saved.status})`,
        createdByEmail: session.email,
      });
      await recordAuditLog({
        actorId: session.userId,
        actorEmail: session.email,
        actorRole: session.role,
        action: "UPDATE",
        entityType: "Service",
        entityId: saved.id,
        entityLabel: saved.name,
        summary: `Updated service "${saved.name}" (${saved.status})`,
      });
      res.json({ item: saved });
      return;
    }

    if (entity === "Industry") {
      const saved = await prisma.industry.update({
        where: { id: payload.id },
        data: {
          name: payload.name,
          intro: payload.intro,
          challengesJson: JSON.stringify(payload.challenges || []),
          solutionsJson: JSON.stringify(payload.solutions || []),
          status: payload.status || "PUBLISHED",
        },
      });
      await saveContentVersion({
        entityType: "Industry",
        entityId: saved.id,
        snapshot: saved,
        changeNote: payload.changeNote || "Updated industry",
        createdByEmail: session.email,
      });
      await recordAuditLog({
        actorId: session.userId,
        actorEmail: session.email,
        actorRole: session.role,
        action: "UPDATE",
        entityType: "Industry",
        entityId: saved.id,
        entityLabel: saved.name,
        summary: `Updated industry "${saved.name}" (${saved.status})`,
      });
      res.json({ item: saved });
      return;
    }

    if (entity === "CaseStudy") {
      const saved = await prisma.caseStudy.update({
        where: { id: payload.id },
        data: {
          name: payload.name,
          sector: payload.sector,
          headline: payload.headline,
          clientDesc: payload.clientDesc,
          challenge: payload.challenge,
          solution: payload.solution,
          quote: payload.quote,
          imageUrl: payload.imageUrl,
          status: payload.status || "PUBLISHED",
        },
      });
      await saveContentVersion({
        entityType: "CaseStudy",
        entityId: saved.id,
        snapshot: saved,
        changeNote: payload.changeNote || "Updated case study",
        createdByEmail: session.email,
      });
      await recordAuditLog({
        actorId: session.userId,
        actorEmail: session.email,
        actorRole: session.role,
        action: "UPDATE",
        entityType: "CaseStudy",
        entityId: saved.id,
        entityLabel: saved.name,
        summary: `Updated portfolio project "${saved.name}" (${saved.status})`,
      });
      res.json({ item: saved });
      return;
    }

    if (entity === "InsightArticle") {
      const slug = slugify(payload.slug || payload.title);
      const saved = payload.id
        ? await prisma.insightArticle.update({
            where: { id: payload.id },
            data: {
              title: payload.title,
              category: payload.category,
              dateLabel: payload.dateLabel,
              readTime: payload.readTime,
              excerpt: payload.excerpt,
              bodyHtml: payload.bodyHtml,
              status: payload.status || "PUBLISHED",
            },
          })
        : await prisma.insightArticle.create({
            data: {
              slug,
              title: payload.title,
              category: payload.category || "Technology",
              dateLabel: payload.dateLabel || "2026",
              readTime: payload.readTime || "5 min read",
              excerpt: payload.excerpt,
              bodyHtml: payload.bodyHtml,
              status: payload.status || "DRAFT",
            },
          });
      await saveContentVersion({
        entityType: "InsightArticle",
        entityId: saved.id,
        snapshot: saved,
        changeNote: payload.changeNote || "Saved insight article",
        createdByEmail: session.email,
      });
      await recordAuditLog({
        actorId: session.userId,
        actorEmail: session.email,
        actorRole: session.role,
        action: payload.id ? "UPDATE" : "CREATE",
        entityType: "InsightArticle",
        entityId: saved.id,
        entityLabel: saved.title,
        summary: `${payload.id ? "Updated" : "Created"} insight "${saved.title}" (${saved.status})`,
      });
      res.json({ item: saved });
      return;
    }

    if (entity === "SaasProduct") {
      const saved = await prisma.saasProduct.update({
        where: { id: payload.id },
        data: {
          name: payload.name,
          tagline: payload.tagline,
          badge: payload.badge,
          summary: payload.summary,
          descriptionHtml: payload.descriptionHtml,
          consolePath: payload.consolePath,
          externalConsoleUrl: payload.externalConsoleUrl || null,
          heroImage: payload.heroImage || null,
          status: payload.status || "PUBLISHED",
        },
      });
      await saveContentVersion({
        entityType: "SaasProduct",
        entityId: saved.id,
        snapshot: saved,
        changeNote: payload.changeNote || "Updated SaaS product",
        createdByEmail: session.email,
      });
      await recordAuditLog({
        actorId: session.userId,
        actorEmail: session.email,
        actorRole: session.role,
        action: "UPDATE",
        entityType: "SaasProduct",
        entityId: saved.id,
        entityLabel: saved.name,
        summary: `Updated SaaS product "${saved.name}" (${saved.status})`,
      });
      res.json({ item: saved });
      return;
    }

    res.status(400).json({ error: "Unknown entity type." });
  } catch (err) {
    console.error("Admin content error:", err);
    res.status(500).json({ error: "Failed to save content." });
  }
});

