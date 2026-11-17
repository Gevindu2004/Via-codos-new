import React from "react";
import Link from "next/link";
import { ArrowRight, Terminal, ExternalLink } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { safeJsonParse } from "@/lib/sanitize";
import { PublicShell } from "@/components/SiteChrome";
import { PageBanner } from "@/components/PageBanner";

export const dynamic = "force-dynamic";

export default async function SaasIndexPage() {
  const products = await prisma.saasProduct.findMany({
    where: { status: "PUBLISHED" },
    orderBy: { sortOrder: "asc" },
  });

  return (
    <PublicShell>
      <PageBanner
        crumbs={[{ label: "SaaS Products" }]}
        eyebrow="Codos Console Ecosystem"
        title="Via Codos SaaS Products"
        subtitle="Skybeak, Thumbs Up APIs, and Call Colleague — three CMS-managed cloud platforms unified under Codos Console."
      />

      <section className="py-16 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-7">
            {products.map((p) => {
              const metrics = safeJsonParse<Array<{ value: string; label: string }>>(
                p.metricsJson,
                []
              );
              return (
                <div
                  key={p.id}
                  className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden flex flex-col justify-between hover:border-[#0A192F] transition"
                >
                  <div>
                    <div
                      className={`aspect-video relative overflow-hidden ${
                        (p.heroImage || "").includes("-logo")
                          ? "bg-gradient-to-br from-slate-50 via-white to-sky-50/70 flex items-center justify-center p-8 border-b border-slate-100"
                          : "bg-[#0A192F]"
                      }`}
                    >
                      <img
                        src={p.heroImage || "/assets/beltkit-poster.jpg"}
                        alt={p.name}
                        className={
                          (p.heroImage || "").includes("-logo")
                            ? "max-h-36 w-auto object-contain drop-shadow-sm"
                            : "h-full w-full object-cover opacity-85"
                        }
                      />
                      <span className="absolute top-3 left-3 rounded-full bg-[#0A0F1A]/90 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-sky-300">
                        {p.badge || "Codos Console"}
                      </span>
                    </div>
                    <div className="p-6">
                      <div className="flex items-center justify-between gap-3">
                        <h2 className="font-heading text-2xl font-bold text-[#0A0F1A]">{p.name}</h2>
                        {p.slug === "skybeak" && (
                          <img
                            src="/assets/skybeak-logo.png"
                            alt="Skybeak logo"
                            className="h-9 w-auto object-contain"
                          />
                        )}
                        {p.slug === "thumbs-up-apis" && (
                          <img
                            src="/assets/thumbs-up-api-logo.png"
                            alt="Thumbs Up APIs logo"
                            className="h-9 w-auto object-contain"
                          />
                        )}
                        {p.slug === "call-colleague" && (
                          <img
                            src="/assets/call-colleague-logo.png"
                            alt="Call Colleague logo"
                            className="h-10 w-auto object-contain"
                          />
                        )}
                      </div>
                      <p className="mt-1 text-xs font-semibold text-[#1D4ED8]">{p.tagline}</p>
                      <p className="mt-3 text-sm text-slate-600 leading-relaxed">{p.summary}</p>
                      {metrics.length > 0 && (
                        <div className="mt-5 grid grid-cols-2 gap-3 pt-4 border-t border-slate-100">
                          {metrics.slice(0, 2).map((m, idx) => (
                            <div key={idx}>
                              <div className="font-heading text-lg font-extrabold text-[#0A192F]">
                                {m.value}
                              </div>
                              <div className="text-[11px] text-slate-500">{m.label}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="p-6 pt-0 flex flex-col gap-2.5">
                    <Link
                      href={`/saas/${p.slug}`}
                      className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-[#0A192F] px-5 py-2.5 text-xs font-semibold text-white hover:bg-[#1E3A8A] transition"
                    >
                      Explore {p.name} Landing Page
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                    <Link
                      href={p.externalConsoleUrl || p.consolePath}
                      className="w-full inline-flex items-center justify-center gap-2 rounded-full border border-slate-300 px-5 py-2 text-xs font-semibold text-[#0A0F1A] hover:border-[#0A192F] transition"
                    >
                      <Terminal className="h-3.5 w-3.5 text-[#1D4ED8]" />
                      Launch in Codos Console
                      <ExternalLink className="h-3 w-3 text-slate-400" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </PublicShell>
  );
}

