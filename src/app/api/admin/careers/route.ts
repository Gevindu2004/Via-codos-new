import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth";
import { recordAuditLog } from "@/lib/audit";
import { slugify } from "@/lib/sanitize";

export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [domains, postings, applications, sampleProfiles] = await Promise.all([
    prisma.jobDomain.findMany({ orderBy: { name: "asc" } }),
    prisma.jobPosting.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.jobApplication.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.talentProfile.findMany({
      where: { visibilityFlag: "SAMPLE", status: "PUBLISHED" },
      orderBy: { profileCode: "asc" },
    }),
  ]);

  return NextResponse.json({ domains, postings, applications, sampleProfiles });
}

export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
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
      return NextResponse.json({ domain });
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
      return NextResponse.json({ job });
    }

    if (action === "UPDATE_SCREENING") {
      const app = await prisma.jobApplication.update({
        where: { id: body.applicationId },
        data: {
          screeningStatus: body.screeningStatus,
          screeningNotes: body.screeningNotes || null,
        },
      });
      return NextResponse.json({ application: app });
    }

    // Convert Approved Applicant (with Consent) into Live Anonymized Real Talent Profile + optionally replace a Sample Profile!
    if (action === "CONVERT_TO_PROFILE") {
      const app = await prisma.jobApplication.findUnique({ where: { id: body.applicationId } });
      if (!app) return NextResponse.json({ error: "Application not found." }, { status: 404 });
      if (!app.consentToProfile) {
        return NextResponse.json(
          { error: "Applicant did not grant consent for anonymized profile publishing." },
          { status: 400 }
        );
      }

      const dom = await prisma.jobDomain.findUnique({ where: { slug: app.domainSlug } });
      const category = dom?.category === "MANAGEMENT" ? "MANAGEMENT" : "IT";
      const prefix = category === "MANAGEMENT" ? "VC-MG" : "VC-IT";
      const randomNum = Math.floor(300 + Math.random() * 699);
      const profileCode = `${prefix}-${randomNum}`;

      const monthlyRate = Number(body.monthlyRateUsd || app.expectedMonthlyRateUsd || 4500);
      const hourlyRate = Math.max(12, Math.round(monthlyRate / 160));

      // Create TalentProfile (preserving displayName while keeping email, phone, photo & CV private)
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

      // Optionally archive/replace a Sample profile
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

      return NextResponse.json({ profile: newProfile });
    }

    return NextResponse.json({ error: "Unknown career action." }, { status: 400 });
  } catch (err) {
    console.error("Admin careers error:", err);
    return NextResponse.json({ error: "Careers operation failed." }, { status: 500 });
  }
}

