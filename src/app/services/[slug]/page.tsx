import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, CheckCircle2, ChevronRight } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { safeJsonParse } from "@/lib/sanitize";
import { PublicShell } from "@/components/SiteChrome";
import { PageBanner } from "@/components/PageBanner";
import { DynamicIcon } from "@/components/IconResolver";

export const dynamic = "force-dynamic";

export default async function ServiceDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const service = await prisma.service.findUnique({ where: { slug } });
  if (!service || service.status !== "PUBLISHED") {
    notFound();
  }

  const related = await prisma.service.findMany({
    where: { groupName: service.groupName, slug: { not: service.slug }, status: "PUBLISHED" },
    orderBy: { sortOrder: "asc" },
    take: 4,
  });

  const paragraphs = safeJsonParse<string[]>(service.bodyJson, []);
  const included = safeJsonParse<string[]>(service.includedJson, []);
  const disciplines = safeJsonParse<Array<{ icon: string; title: string; desc: string }>>(
    service.disciplinesJson,
    []
  );
  const levels = safeJsonParse<
    Array<{ icon: string; title: string; years: string; desc: string }>
  >(service.levelsJson, []);

  return (
    <PublicShell>
      <PageBanner
        crumbs={[{ label: "Services", href: "/services" }, { label: service.name }]}
        eyebrow={service.tagline}
        title={service.name}
        subtitle={service.oneliner}
      />

      <section className="py-16 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
            {/* Main Content */}
            <div className="lg:col-span-8 space-y-6">
              {service.videoUrl && (
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-[#0A0F1A] shadow-md">
                  <div className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-sky-300 border-b border-white/10">
                    {service.name} — Product Tour
                  </div>
                  <video
                    controls
                    preload="metadata"
                    playsInline
                    poster={service.posterUrl || undefined}
                    className="w-full aspect-video"
                  >
                    <source src={service.videoUrl} type="video/mp4" />
                  </video>
                </div>
              )}

              <div className="vc-prose">
                {paragraphs.map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>

              <div className="rounded-2xl border border-slate-200 bg-[#F8FAFC] p-7 mt-8">
                <h2 className="font-heading text-xl font-bold text-[#0A192F] mb-4">
                  What&apos;s Included
                </h2>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {included.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2.5 text-sm text-slate-700">
                      <CheckCircle2 className="h-4 w-4 text-[#1D4ED8] mt-0.5 shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Sidebar */}
            <aside className="lg:col-span-4 space-y-6">
              <div className="rounded-2xl border border-[#0A192F] bg-[#0A192F] p-7 text-white shadow-lg">
                <div className="font-heading text-4xl font-extrabold text-sky-300">
                  {service.statValue}
                </div>
                <div className="text-sm text-slate-200 mt-1 pb-5 border-b border-white/15">
                  {service.statLabel}
                </div>
                <h3 className="font-heading text-lg font-bold mt-5">Start the Conversation</h3>
                <p className="mt-2 text-sm text-slate-300 leading-relaxed">
                  Tell us what you are building or scaling. We respond rapidly under NDA with a clear architecture and staffing plan.
                </p>
                <div className="mt-5 space-y-2.5">
                  <Link
                    href={
                      service.slug === "it-outsourcing"
                        ? "/staff-augmentation/request"
                        : "/contact"
                    }
                    className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-bold text-[#0A0F1A] hover:bg-sky-50 transition"
                  >
                    {service.slug === "it-outsourcing"
                      ? "Request Engineers Now"
                      : "Get a Free Consultation"}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  {service.slug === "it-outsourcing" && (
                    <Link
                      href="/talent"
                      className="w-full inline-flex items-center justify-center gap-2 rounded-full border border-white/25 px-5 py-2.5 text-xs font-semibold text-white hover:bg-white/10 transition"
                    >
                      Browse Anonymized Talent Bench
                    </Link>
                  )}
                </div>
              </div>

              {related.length > 0 && (
                <div className="rounded-2xl border border-slate-200 bg-white p-6">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                    Related Services
                  </h4>
                  <div className="divide-y divide-slate-100">
                    {related.map((r) => (
                      <Link
                        key={r.id}
                        href={`/services/${r.slug}`}
                        className="flex items-center justify-between py-3 text-sm font-medium text-[#0A0F1A] hover:text-[#1D4ED8] transition"
                      >
                        <span>{r.name}</span>
                        <ChevronRight className="h-4 w-4 text-slate-400" />
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </aside>
          </div>
        </div>
      </section>

      {disciplines.length > 0 && (
        <section className="py-16 bg-[#F8FAFC] border-t border-slate-200">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-2xl mx-auto mb-10">
              <span className="text-xs font-bold uppercase tracking-[0.18em] text-[#1D4ED8]">
                Coverage
              </span>
              <h2 className="font-heading mt-2 text-3xl font-bold text-[#0A0F1A]">
                Every Discipline. Every Level. One Partner.
              </h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {disciplines.map((d, idx) => (
                <div key={idx} className="rounded-xl border border-slate-200 bg-white p-5">
                  <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-[#0A192F]/5 text-[#0A192F]">
                    <DynamicIcon name={d.icon} className="h-4 w-4" />
                  </div>
                  <h3 className="font-heading mt-3 text-base font-bold text-[#0A0F1A]">
                    {d.title}
                  </h3>
                  <p className="mt-1 text-sm text-slate-600">{d.desc}</p>
                </div>
              ))}
            </div>
            {levels.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-8">
                {levels.map((l, idx) => (
                  <div
                    key={idx}
                    className="rounded-xl border border-[#0A192F]/15 bg-[#0A192F] p-6 text-white"
                  >
                    <div className="text-xs font-semibold uppercase tracking-wider text-sky-300">
                      {l.years}
                    </div>
                    <h3 className="font-heading mt-1 text-xl font-bold">{l.title}</h3>
                    <p className="mt-2 text-sm text-slate-300">{l.desc}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}
    </PublicShell>
  );
}

