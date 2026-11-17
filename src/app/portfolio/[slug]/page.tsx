import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { safeJsonParse } from "@/lib/sanitize";
import { PublicShell } from "@/components/SiteChrome";
import { PageBanner } from "@/components/PageBanner";

export const dynamic = "force-dynamic";

export default async function PortfolioDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const c = await prisma.caseStudy.findUnique({ where: { slug } });
  if (!c || c.status !== "PUBLISHED") notFound();

  const implementation = safeJsonParse<string[]>(c.implementationJson, []);
  const results = safeJsonParse<Array<{ value: string; label: string }>>(c.resultsJson, []);

  return (
    <PublicShell>
      <PageBanner
        crumbs={[
          { label: "Portfolio", href: "/portfolio" },
          { label: c.name },
        ]}
        eyebrow={c.sector}
        title={c.name}
        subtitle={c.headline}
      />

      <section className="py-16 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-12">
          <div className="lg:col-span-8 space-y-6">
            {c.videoUrl && (
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-[#0A0F1A]">
                <video
                  controls
                  preload="metadata"
                  playsInline
                  poster={c.posterUrl || undefined}
                  className="w-full aspect-video"
                >
                  <source src={c.videoUrl} type="video/mp4" />
                </video>
              </div>
            )}

            <div className="vc-prose">
              <h2>The Client</h2>
              <p>{c.clientDesc}</p>
              <h2>The Challenge</h2>
              <p>{c.challenge}</p>
              <h2>Our Solution</h2>
              <p>{c.solution}</p>
              <h2>Implementation</h2>
              <ul>
                {implementation.map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ul>
              <blockquote>&ldquo;{c.quote}&rdquo;</blockquote>
            </div>
          </div>

          <aside className="lg:col-span-4 space-y-6">
            <div className="rounded-2xl bg-[#0A192F] p-7 text-white shadow-lg">
              {results[0] && (
                <>
                  <div className="font-heading text-4xl font-extrabold text-sky-300">
                    {results[0].value}
                  </div>
                  <div className="text-sm text-slate-200 mt-1 pb-5 border-b border-white/15">
                    {results[0].label}
                  </div>
                </>
              )}
              <h3 className="font-heading text-lg font-bold mt-5">Want results like these?</h3>
              <p className="mt-2 text-sm text-slate-300">
                Every flagship platform started as a client&apos;s operational bottleneck.
              </p>
              <Link
                href="/contact"
                className="mt-5 w-full inline-flex items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-bold text-[#0A0F1A] hover:bg-sky-50"
              >
                Get a Free Consultation <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-[#F8FAFC] p-6 space-y-3">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Measurable Impact
              </div>
              {results.map((r, idx) => (
                <div key={idx} className="flex items-start gap-2.5 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-[#1D4ED8] mt-0.5 shrink-0" />
                  <div>
                    <strong className="text-[#0A0F1A]">{r.value}</strong> —{" "}
                    <span className="text-slate-600">{r.label}</span>
                  </div>
                </div>
              ))}
            </div>
          </aside>
        </div>
      </section>
    </PublicShell>
  );
}

