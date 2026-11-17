import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { safeJsonParse, sanitizeRichHtml } from "@/lib/sanitize";
import { PublicShell } from "@/components/SiteChrome";
import { PageBanner } from "@/components/PageBanner";

export const dynamic = "force-dynamic";

export default async function DynamicCmsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = await prisma.cmsPage.findUnique({
    where: { slug },
    include: {
      category: true,
      sections: { where: { isVisible: true }, orderBy: { sortOrder: "asc" } },
    },
  });

  if (!page || page.status !== "PUBLISHED") {
    notFound();
  }

  return (
    <PublicShell>
      <PageBanner
        crumbs={[
          ...(page.category ? [{ label: page.category.name }] : []),
          { label: page.title },
        ]}
        eyebrow={page.category?.name || "Via Codos"}
        title={page.title}
        subtitle={page.subtitle || undefined}
      />

      <div className="bg-white">
        {page.sections.map((sec) => {
          if (sec.type === "STATS_GRID") {
            const stats = safeJsonParse<Array<{ value: string; label: string }>>(sec.dataJson, []);
            return (
              <section key={sec.id} className="bg-[#0A192F] text-white py-14">
                <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
                  {sec.title && (
                    <h2 className="font-heading text-2xl font-bold text-center mb-8">
                      {sec.title}
                    </h2>
                  )}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 text-center">
                    {stats.map((st, idx) => (
                      <div key={idx}>
                        <div className="font-heading text-3xl font-extrabold text-sky-300">
                          {st.value}
                        </div>
                        <div className="text-xs text-slate-300 mt-1">{st.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            );
          }

          if (sec.type === "CARDS_GRID") {
            const cards = safeJsonParse<Array<{ title: string; desc: string }>>(sec.dataJson, []);
            return (
              <section key={sec.id} className="py-16 bg-[#F8FAFC] border-b border-slate-200">
                <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
                  {sec.title && (
                    <div className="mb-8">
                      <h2 className="font-heading text-2xl font-bold text-[#0A0F1A]">
                        {sec.title}
                      </h2>
                      {sec.subtitle && <p className="text-sm text-slate-600 mt-1">{sec.subtitle}</p>}
                    </div>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {cards.map((card, idx) => (
                      <div key={idx} className="rounded-2xl border border-slate-200 bg-white p-6">
                        <h3 className="font-heading text-lg font-bold text-[#0A0F1A]">
                          {card.title}
                        </h3>
                        <p className="mt-2 text-sm text-slate-600">{card.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            );
          }

          if (sec.type === "CTA_BAND") {
            const data = safeJsonParse<{ ctaLabel?: string; ctaHref?: string }>(sec.dataJson, {});
            return (
              <section key={sec.id} className="py-16 bg-[#0A0F1A] text-white text-center">
                <div className="mx-auto max-w-3xl px-4">
                  {sec.title && <h2 className="font-heading text-3xl font-bold">{sec.title}</h2>}
                  {sec.subtitle && <p className="mt-3 text-slate-300 text-sm">{sec.subtitle}</p>}
                  <Link
                    href={data.ctaHref || "/contact"}
                    className="mt-6 inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-bold text-[#0A0F1A] hover:bg-sky-50"
                  >
                    {data.ctaLabel || "Get in Touch"} <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </section>
            );
          }

          return (
            <section key={sec.id} className="py-14 border-b border-slate-100">
              <div className="mx-auto max-w-4xl px-4 sm:px-6">
                {sec.title && (
                  <h2 className="font-heading text-2xl font-bold text-[#0A0F1A] mb-2">
                    {sec.title}
                  </h2>
                )}
                {sec.subtitle && <p className="text-sm text-slate-500 mb-5">{sec.subtitle}</p>}
                {sec.imageUrl && (
                  <img
                    src={sec.imageUrl}
                    alt={sec.title || page.title}
                    className="mb-6 rounded-2xl border border-slate-200 w-full max-h-96 object-cover"
                  />
                )}
                {sec.bodyHtml && (
                  <div
                    className="vc-prose"
                    dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(sec.bodyHtml) }}
                  />
                )}
              </div>
            </section>
          );
        })}
      </div>
    </PublicShell>
  );
}

