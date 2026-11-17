import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PublicShell } from "@/components/SiteChrome";
import { PageBanner } from "@/components/PageBanner";

export const dynamic = "force-dynamic";

export default async function InsightDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const article = await prisma.insightArticle.findUnique({ where: { slug } });
  if (!article || article.status !== "PUBLISHED") notFound();

  const more = await prisma.insightArticle.findMany({
    where: { status: "PUBLISHED", slug: { not: slug } },
    orderBy: { sortOrder: "asc" },
    take: 3,
  });

  return (
    <PublicShell>
      <PageBanner
        crumbs={[
          { label: "Insights", href: "/insights" },
          { label: article.title },
        ]}
        eyebrow={`${article.category} · ${article.dateLabel} · ${article.readTime}`}
        title={article.title}
        subtitle={article.excerpt}
      />

      <section className="py-14 bg-white">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <Link
            href="/insights"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1D4ED8] mb-6 hover:underline"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> All Insights
          </Link>
          <article
            className="vc-prose"
            dangerouslySetInnerHTML={{ __html: article.bodyHtml }}
          />
        </div>
      </section>

      {more.length > 0 && (
        <section className="py-14 bg-[#F8FAFC] border-t border-slate-200">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <h2 className="font-heading text-2xl font-bold text-[#0A0F1A] mb-6">
              More Insights
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {more.map((o) => (
                <Link
                  key={o.id}
                  href={`/insights/${o.slug}`}
                  className="rounded-2xl border border-slate-200 bg-white p-5 hover:border-[#0A192F] transition"
                >
                  <div className="text-[11px] font-semibold text-[#1D4ED8]">
                    {o.category} · {o.dateLabel}
                  </div>
                  <h3 className="font-heading mt-2 text-base font-bold text-[#0A0F1A]">
                    {o.title}
                  </h3>
                  <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[#0A192F]">
                    Read <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
    </PublicShell>
  );
}

