import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, CheckCircle2, Terminal, ExternalLink } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { safeJsonParse } from "@/lib/sanitize";
import { PublicShell } from "@/components/SiteChrome";
import { PageBanner } from "@/components/PageBanner";
import { DynamicIcon } from "@/components/IconResolver";

export const dynamic = "force-dynamic";

export default async function SaasDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = await prisma.saasProduct.findUnique({ where: { slug } });
  if (!product || product.status !== "PUBLISHED") {
    notFound();
  }

  const features = safeJsonParse<Array<{ icon: string; title: string; desc: string }>>(
    product.featuresJson,
    []
  );
  const metrics = safeJsonParse<Array<{ value: string; label: string }>>(
    product.metricsJson,
    []
  );
  const tiers = safeJsonParse<
    Array<{ name: string; price: string; period: string; features: string[] }>
  >(product.pricingTiersJson, []);

  const consoleTarget = product.externalConsoleUrl || product.consolePath;

  return (
    <PublicShell>
      <PageBanner
        crumbs={[
          { label: "SaaS Products", href: "/saas" },
          { label: product.name },
        ]}
        eyebrow={product.badge || "Codos Console SaaS"}
        title={product.name}
        subtitle={product.tagline}
      />

      {/* Redirect / Launch Bar to Codos Console */}
      <div className="bg-[#F8FAFC] border-b border-slate-200">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-sm text-slate-700">
            <Terminal className="h-5 w-5 text-[#1D4ED8]" />
            <span>
              <strong>{product.name}</strong> runs inside the unified{" "}
              <strong className="text-[#0A192F]">Codos Console</strong> workspace.
            </span>
          </div>
          <Link
            href={consoleTarget}
            className="inline-flex items-center gap-2 rounded-full bg-[#1D4ED8] px-5 py-2 text-xs font-bold text-white shadow-sm hover:bg-[#0A192F] transition shrink-0"
          >
            Continue to Codos Console
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      <section className="py-16 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-16">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-7">
              <div
                className="vc-prose"
                dangerouslySetInnerHTML={{ __html: product.descriptionHtml }}
              />
              <div className="mt-7 flex flex-wrap gap-3">
                <Link
                  href={consoleTarget}
                  className="inline-flex items-center gap-2 rounded-full bg-[#0A192F] px-6 py-3 text-sm font-semibold text-white hover:bg-[#1E3A8A] transition"
                >
                  Open {product.name} in Codos Console
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/contact"
                  className="inline-flex items-center gap-2 rounded-full border border-slate-300 px-6 py-3 text-sm font-semibold text-[#0A0F1A] hover:border-[#0A192F] transition"
                >
                  Book Enterprise Demo
                </Link>
              </div>
            </div>

            <div className="lg:col-span-5">
              <div className="rounded-2xl border border-slate-200 overflow-hidden shadow-lg bg-[#0A192F] text-white">
                {(product.heroImage || "").includes("-logo") ? (
                  <div className="w-full aspect-video bg-gradient-to-br from-slate-50 via-white to-sky-50/70 flex items-center justify-center p-8 border-b border-slate-200/80">
                    <img
                      src={product.heroImage || "/assets/skybeak-logo.png"}
                      alt={product.name}
                      className="max-h-full max-w-full object-contain drop-shadow-sm"
                    />
                  </div>
                ) : (
                  <img
                    src={product.heroImage || "/assets/beltkit-poster.jpg"}
                    alt={product.name}
                    className="w-full aspect-video object-cover"
                  />
                )}
                <div className="p-6 grid grid-cols-3 gap-4">
                  {metrics.map((m, idx) => (
                    <div key={idx}>
                      <div className="font-heading text-xl font-extrabold text-sky-300">
                        {m.value}
                      </div>
                      <div className="text-[11px] text-slate-300 mt-0.5">{m.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Features */}
          <div>
            <h2 className="font-heading text-2xl font-bold text-[#0A0F1A] mb-6">
              Platform Capabilities
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {features.map((f, idx) => (
                <div
                  key={idx}
                  className="rounded-2xl border border-slate-200 bg-[#F8FAFC] p-6"
                >
                  <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[#0A192F] text-white">
                    <DynamicIcon name={f.icon} className="h-5 w-5" />
                  </div>
                  <h3 className="font-heading mt-4 text-lg font-bold text-[#0A0F1A]">
                    {f.title}
                  </h3>
                  <p className="mt-2 text-sm text-slate-600 leading-relaxed">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Pricing Tiers */}
          {tiers.length > 0 && (
            <div>
              <h2 className="font-heading text-2xl font-bold text-[#0A0F1A] mb-6">
                Workspace Plans in Codos Console
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl">
                {tiers.map((tier, idx) => (
                  <div
                    key={idx}
                    className={`rounded-2xl border p-7 ${
                      idx === 1
                        ? "border-[#0A192F] bg-[#0A192F] text-white shadow-xl"
                        : "border-slate-200 bg-white text-[#0A0F1A]"
                    }`}
                  >
                    <div className="text-xs font-bold uppercase tracking-wider text-sky-400">
                      {tier.name}
                    </div>
                    <div className="mt-2 flex items-baseline gap-1">
                      <span className="font-heading text-4xl font-extrabold">{tier.price}</span>
                      <span className={idx === 1 ? "text-slate-300 text-sm" : "text-slate-500 text-sm"}>
                        {tier.period}
                      </span>
                    </div>
                    <ul className="mt-5 space-y-2.5 text-sm">
                      {tier.features.map((feat, fidx) => (
                        <li key={fidx} className="flex items-center gap-2">
                          <CheckCircle2
                            className={`h-4 w-4 shrink-0 ${
                              idx === 1 ? "text-sky-300" : "text-[#1D4ED8]"
                            }`}
                          />
                          <span>{feat}</span>
                        </li>
                      ))}
                    </ul>
                    <Link
                      href={consoleTarget}
                      className={`mt-6 w-full inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-xs font-bold transition ${
                        idx === 1
                          ? "bg-white text-[#0A0F1A] hover:bg-sky-50"
                          : "bg-[#0A192F] text-white hover:bg-[#1E3A8A]"
                      }`}
                    >
                      Provision {tier.name} in Codos Console
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
    </PublicShell>
  );
}

