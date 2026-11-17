import React from "react";
import { prisma } from "@/lib/prisma";
import { safeJsonParse } from "@/lib/sanitize";
import { PublicShell } from "@/components/SiteChrome";
import { PageBanner } from "@/components/PageBanner";
import { CareersApplyClient } from "@/components/CareersApplyClient";

export const dynamic = "force-dynamic";

export default async function CareersPage() {
  const [postings, domains] = await Promise.all([
    prisma.jobPosting.findMany({
      where: { status: "PUBLISHED" },
      orderBy: { createdAt: "desc" },
    }),
    prisma.jobDomain.findMany({ orderBy: { name: "asc" } }),
  ]);

  const mappedJobs = postings.map((p) => ({
    id: p.id,
    title: p.title,
    domainSlug: p.domainSlug,
    domainName: p.domainName,
    employmentType: p.employmentType,
    location: p.location,
    experienceRequired: p.experienceRequired,
    skills: safeJsonParse<string[]>(p.skillsJson, []),
    responsibilities: safeJsonParse<string[]>(p.responsibilitiesJson, []),
  }));

  return (
    <PublicShell>
      <PageBanner
        crumbs={[{ label: "Company", href: "/company/about" }, { label: "Careers" }]}
        eyebrow="Careers & Talent Pipeline"
        title="Join the Via Codos Engineering & Management Network"
        subtitle="Work directly with global enterprises across the US, UK, EU, and Australia. Remote-first, high-trust pods."
      />
      <section className="py-16 bg-white">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <CareersApplyClient jobs={mappedJobs} domains={domains} />
        </div>
      </section>
    </PublicShell>
  );
}

