import React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PublicShell } from "@/components/SiteChrome";
import { PageBanner } from "@/components/PageBanner";

export const dynamic = "force-dynamic";

export default async function InsightsPage() {
  const articles = await prisma.insightArticle.findMany({
    where: { status: "PUBLISHED" },
    orderBy: { sortOrder: "asc" },
  });

  return (
    <PublicShell>
      <PageBanner
        crumbs={[{ label: "Insights & Case Studies" }]}
        eyebrow="Insights & Case Studies"
        title="Insights & Case Studies"
        subtitle="Research, benchmarks, and architectural perspectives on IT outsourcing, AI automation, ERP modernization, and cybersecurity."
      />
      <section className="py-16 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {articles.map((a) => (
            <Link
              key={a.id}
              href={`/insights/${a.slug}`}
              className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:border-[#0A192F] hover:shadow-md transition flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-500">
                  <span className="rounded-full bg-[#0A192F]/5 px-2.5 py-0.5 text-[#1D4ED8]">
                    {a.category}
                  </span>
                  <span>•</span>
                  <span>{a.dateLabel}</span>
                  <span>•</span>
                  <span>{a.readTime}</span>
                </div>
                <h2 className="font-heading mt-3 text-lg font-bold text-[#0A0F1A] group-hover:text-[#1D4ED8] transition leading-snug">
                  {a.title}
                </h2>
                <p className="mt-2 text-sm text-slate-600 line-clamp-3">{a.excerpt}</p>
              </div>
              <span className="mt-5 inline-flex items-center gap-1.5 text-xs font-semibold text-[#0A0F1A]">
                Read article <ArrowRight className="h-3.5 w-3.5" />
              </span>
            </Link>
          ))}
        </div>
      </section>
    </PublicShell>
  );
}
