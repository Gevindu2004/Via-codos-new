import fs from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/sanitize";
import {
  checkRateLimit,
  getClientIp,
  resolveUploadStorageDir,
  validateAndScanUploadBuffer,
} from "@/lib/security";

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req.headers);
    const limit = checkRateLimit(`careers-apply:${ip}`, 10, 15 * 60 * 1000);
    if (!limit.allowed) {
      return NextResponse.json(
        { error: "Too many submissions. Please wait before trying again." },
        { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } }
      );
    }

    const formData = await req.formData();
    const applicantName = String(formData.get("applicantName") || "").trim();
    const applicantEmail = String(formData.get("applicantEmail") || "").trim();
    const applicantPhone = String(formData.get("applicantPhone") || "").trim();
    const portfolioUrl = String(formData.get("portfolioUrl") || "").trim();
    const jobPostingId = String(formData.get("jobPostingId") || "").trim() || null;
    const selectedDomain = String(formData.get("selectedDomain") || "").trim();
    const customDomainName = String(formData.get("customDomainName") || "").trim();
    const domainCategory = String(formData.get("domainCategory") || "IT").trim();
    const skillsRaw = String(formData.get("skills") || "").trim();
    const yearsExperience = Number(formData.get("yearsExperience") || "0");
    const expectedMonthlyRateUsd = Number(formData.get("expectedMonthlyRateUsd") || "0") || null;
    const summary = String(formData.get("summary") || "").trim();
    const consentToProfile = formData.get("consentToProfile") === "true";
    const cvFile = formData.get("cv") as File | null;

    if (!applicantName || !applicantEmail) {
      return NextResponse.json(
        { error: "Full name and email address are required." },
        { status: 400 }
      );
    }

    // Determine domain: either existing or auto-create a new domain!
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

    // Also ensure TalentDomain exists so approved conversion works seamlessly
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

    // Save uploaded CV file safely outside executable webroot with magic-byte + malware scan
    let cvFileUrl: string | null = null;
    let cvOriginalName: string | null = null;
    if (cvFile && cvFile.size > 0) {
      const buffer = Buffer.from(await cvFile.arrayBuffer());
      const scan = await validateAndScanUploadBuffer(cvFile.name, cvFile.type, buffer, "cv");
      if (!scan.ok) {
        return NextResponse.json({ error: scan.error }, { status: 400 });
      }
      const dir = resolveUploadStorageDir("cvs");
      await fs.mkdir(dir, { recursive: true });
      const fileName = scan.safeFilename;
      const absPath = path.join(dir, fileName);
      await fs.writeFile(absPath, buffer, { mode: 0o644 });
      cvFileUrl = `/api/careers/cv/${fileName}`;
      cvOriginalName = cvFile.name;
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

    return NextResponse.json({
      application,
      autoCreatedDomain,
      domainName: finalDomainName,
    });
  } catch (err) {
    console.error("Career application error:", err);
    return NextResponse.json(
      { error: "Failed to submit career application." },
      { status: 500 }
    );
  }
}

