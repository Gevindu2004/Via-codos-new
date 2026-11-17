import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Calendar, FileCheck2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { sanitizeRichHtml } from "@/lib/sanitize";
import { PublicShell } from "@/components/SiteChrome";
import { PageBanner } from "@/components/PageBanner";

export const dynamic = "force-dynamic";

export default async function LegalDocDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const doc = await prisma.legalDocument.findUnique({
    where: { slug },
    include: { type: true },
  });

  if (!doc || !doc.isPublic || doc.status !== "PUBLISHED") {
    notFound();
  }

  return (
    <PublicShell>
      <PageBanner
        crumbs={[
          { label: "Legal & Governance", href: "/legal" },
          { label: doc.title },
        ]}
        eyebrow={`${doc.type.name} · Version ${doc.version}`}
        title={doc.title}
        subtitle={doc.summary || undefined}
      />

      <section className="py-14 bg-white">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <div className="mb-8 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-[#F8FAFC] px-5 py-3.5 text-xs text-slate-600">
            <div className="flex items-center gap-4">
              <span className="inline-flex items-center gap-1.5 font-semibold text-[#0A0F1A]">
                <FileCheck2 className="h-4 w-4 text-[#1D4ED8]" />
                Version {doc.version}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="h-4 w-4 text-slate-500" />
                Effective Date: {new Date(doc.effectiveDate).toLocaleDateString()}
              </span>
            </div>
            <Link
              href="/legal"
              className="inline-flex items-center gap-1 font-semibold text-[#0A192F] hover:text-[#1D4ED8]"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              All Policies
            </Link>
          </div>

          <article
            className="vc-prose"
            dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(doc.contentHtml) }}
          />
        </div>
      </section>
    </PublicShell>
  );
}

