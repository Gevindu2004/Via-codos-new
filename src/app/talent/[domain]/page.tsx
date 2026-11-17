import React from "react";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { anonymizeTalentProfile } from "@/lib/sanitize";
import { getClientSession } from "@/lib/auth";
import { PublicShell } from "@/components/SiteChrome";
import { PageBanner } from "@/components/PageBanner";
import { TalentBrowser } from "@/components/TalentBrowser";

export const dynamic = "force-dynamic";

export default async function TalentDomainPage({
  params,
}: {
  params: Promise<{ domain: string }>;
}) {
  const { domain } = await params;
  const [domRecord, rawProfiles, domains, session] = await Promise.all([
    prisma.talentDomain.findUnique({ where: { slug: domain } }),
    prisma.talentProfile.findMany({
      where: { status: "PUBLISHED" },
      orderBy: [{ visibilityFlag: "asc" }, { profileCode: "asc" }],
    }),
    prisma.talentDomain.findMany({ orderBy: { sortOrder: "asc" } }),
    getClientSession(),
  ]);

  if (!domRecord) {
    notFound();
  }

  let verificationStatus: string | null = null;
  if (session) {
    const client = await prisma.clientUser.findUnique({ where: { id: session.clientId } });
    verificationStatus = client?.verificationStatus ?? null;
  }

  return (
    <PublicShell>
      <PageBanner
        crumbs={[{ label: "Talent Bench", href: "/talent" }, { label: domRecord.name }]}
        eyebrow={`${domRecord.category} Domain`}
        title={domRecord.name}
        subtitle={domRecord.description || `Browse vetted ${domRecord.name} profiles under anonymized Profile IDs.`}
      />
      <section className="py-12 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <TalentBrowser
            initialProfiles={rawProfiles.map(anonymizeTalentProfile)}
            domains={domains}
            initialDomain={domain}
            isClientLoggedIn={Boolean(session)}
            clientVerificationStatus={verificationStatus}
          />
        </div>
      </section>
    </PublicShell>
  );
}

