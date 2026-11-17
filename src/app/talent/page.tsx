import React from "react";
import { prisma } from "@/lib/prisma";
import { anonymizeTalentProfile } from "@/lib/sanitize";
import { getClientSession } from "@/lib/auth";
import { PublicShell } from "@/components/SiteChrome";
import { PageBanner } from "@/components/PageBanner";
import { TalentBrowser } from "@/components/TalentBrowser";

export const dynamic = "force-dynamic";

export default async function TalentPage() {
  const [rawProfiles, domains, session] = await Promise.all([
    prisma.talentProfile.findMany({
      where: { status: "PUBLISHED" },
      orderBy: [{ visibilityFlag: "asc" }, { profileCode: "asc" }],
    }),
    prisma.talentDomain.findMany({ orderBy: { sortOrder: "asc" } }),
    getClientSession(),
  ]);

  let verificationStatus: string | null = null;
  if (session) {
    const client = await prisma.clientUser.findUnique({ where: { id: session.clientId } });
    verificationStatus = client?.verificationStatus ?? null;
  }

  return (
    <PublicShell>
      <PageBanner
        crumbs={[{ label: "Talent Bench" }]}
        eyebrow="Staff Augmentation · Anonymized Profiles"
        title="Vetted IT, Legacy & Management Talent Bench"
        subtitle="Browse anonymized engineering and management specialists by domain, skill, experience, industry, and availability — under strict NDA-first governance."
      />
      <section className="py-12 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <TalentBrowser
            initialProfiles={rawProfiles.map(anonymizeTalentProfile)}
            domains={domains}
            isClientLoggedIn={Boolean(session)}
            clientVerificationStatus={verificationStatus}
          />
        </div>
      </section>
    </PublicShell>
  );
}

