import { Router } from "express";
import { prisma } from "../lib/prisma";
import { anonymizeTalentProfile } from "../lib/sanitize";
import { recordAuditLog } from "../lib/audit";
import { requireAdmin, type AuthenticatedRequest } from "../middleware/auth";

export const talentRouter = Router();

// Public anonymized talent search
talentRouter.get("/talent", async (req, res) => {
  try {
    const category = typeof req.query.category === "string" ? req.query.category : undefined;
    const domain = typeof req.query.domain === "string" ? req.query.domain : undefined;
    const skill =
      typeof req.query.skill === "string" ? req.query.skill.toLowerCase().trim() : undefined;
    const industry =
      typeof req.query.industry === "string" ? req.query.industry.toLowerCase().trim() : undefined;
    const availability =
      typeof req.query.availability === "string" ? req.query.availability : undefined;
    const minExp = Number(req.query.minExp || "0");
    const q = typeof req.query.q === "string" ? req.query.q.toLowerCase().trim() : undefined;

    const where: Record<string, unknown> = { status: "PUBLISHED" };
    if (category && category !== "ALL") where.category = category;
    if (domain && domain !== "ALL") where.domainSlug = domain;
    if (availability && availability !== "ALL") where.availability = availability;
    if (minExp > 0) where.yearsExperience = { gte: minExp };

    const raw = await prisma.talentProfile.findMany({
      where,
      orderBy: [{ visibilityFlag: "asc" }, { profileCode: "asc" }],
    });

    const anonymized = raw.map(anonymizeTalentProfile).filter((p) => {
      if (skill && !p.skills.some((s) => s.toLowerCase().includes(skill))) {
        return false;
      }
      if (industry && !p.industries.some((i) => i.toLowerCase().includes(industry))) {
        return false;
      }
      if (q) {
        const hay = `${p.profileCode} ${p.displayName || ""} ${p.roleTitle} ${p.domainName} ${p.summary} ${p.skills.join(" ")}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    res.json({ profiles: anonymized });
  } catch (err) {
    console.error("Talent list error:", err);
    res.status(500).json({ error: "Failed to load talent profiles." });
  }
});

// Admin talent bench management
talentRouter.get("/admin/talent", requireAdmin, async (_req, res) => {
  const [profiles, domains] = await Promise.all([
    prisma.talentProfile.findMany({ orderBy: [{ visibilityFlag: "asc" }, { profileCode: "asc" }] }),
    prisma.talentDomain.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);

  const stats = {
    total: profiles.length,
    sampleCount: profiles.filter((p) => p.visibilityFlag === "SAMPLE" && p.status === "PUBLISHED").length,
    realCount: profiles.filter((p) => p.visibilityFlag === "REAL" && p.status === "PUBLISHED").length,
    placedCount: profiles.filter((p) => p.placementStatus === "PLACED").length,
  };

  res.json({ profiles, domains, stats });
});

talentRouter.post("/admin/talent", requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const session = req.adminSession!;
    const body = req.body ?? {};

    if (body.action === "RETIRE_SAMPLE") {
      await prisma.talentProfile.update({
        where: { id: body.id },
        data: { status: "ARCHIVED" },
      });
      await recordAuditLog({
        actorId: session.userId,
        actorEmail: session.email,
        actorRole: session.role,
        action: "ARCHIVE_SAMPLE",
        entityType: "TalentProfile",
        entityId: body.id,
        entityLabel: body.profileCode || body.id,
        summary: `Archived sample profile ${body.profileCode || body.id}`,
      });
      res.json({ ok: true });
      return;
    }

    const monthlyRate = Number(body.monthlyRateUsd || 4500);
    const hourlyRate = Number(body.hourlyRateUsd || Math.max(12, Math.round(monthlyRate / 160)));

    const saved = body.id
      ? await prisma.talentProfile.update({
          where: { id: body.id },
          data: {
            displayName: body.displayName ?? null,
            roleTitle: body.roleTitle,
            summary: body.summary,
            skillsJson: JSON.stringify(body.skills || []),
            yearsExperience: Number(body.yearsExperience || 5),
            availability: body.availability || "IMMEDIATE",
            hourlyRateUsd: hourlyRate,
            monthlyRateUsd: monthlyRate,
            placementStatus: body.placementStatus || "AVAILABLE",
            visibilityFlag: body.visibilityFlag || "SAMPLE",
            status: body.status || "PUBLISHED",
          },
        })
      : await prisma.talentProfile.create({
          data: {
            profileCode: body.profileCode,
            displayName: body.displayName ?? null,
            category: body.category || "IT",
            domainSlug: body.domainSlug || "software-engineering",
            domainName: body.domainName || "Software Engineering",
            roleTitle: body.roleTitle,
            summary: body.summary,
            skillsJson: JSON.stringify(body.skills || []),
            yearsExperience: Number(body.yearsExperience || 5),
            projectsJson: JSON.stringify(body.projects || []),
            industriesJson: JSON.stringify(body.industries || ["External IT Sector"]),
            availability: body.availability || "IMMEDIATE",
            hourlyRateUsd: hourlyRate,
            monthlyRateUsd: monthlyRate,
            visibilityFlag: body.visibilityFlag || "REAL",
            placementStatus: body.placementStatus || "AVAILABLE",
            status: body.status || "PUBLISHED",
          },
        });

    await recordAuditLog({
      actorId: session.userId,
      actorEmail: session.email,
      actorRole: session.role,
      action: body.id ? "UPDATE" : "CREATE",
      entityType: "TalentProfile",
      entityId: saved.id,
      entityLabel: saved.profileCode,
      summary: `${body.id ? "Updated" : "Created"} talent profile ${saved.profileCode}`,
    });

    res.json({ profile: saved });
  } catch (err) {
    console.error("Admin talent error:", err);
    res.status(500).json({ error: "Failed to save talent profile." });
  }
});

