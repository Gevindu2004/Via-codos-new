import React from "react";
import Link from "next/link";
import {
  Terminal,
  PhoneCall,
  Activity,
  KeyRound,
  ArrowLeft,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { sanitizeRichHtml } from "@/lib/sanitize";
import { PublicShell } from "@/components/SiteChrome";

export const dynamic = "force-dynamic";

export default async function CodosConsolePage({
  searchParams,
}: {
  searchParams: Promise<{ product?: string }>;
}) {
  const { product } = await searchParams;
  const products = await prisma.saasProduct.findMany({
    where: { status: "PUBLISHED" },
    orderBy: { sortOrder: "asc" },
  });

  const activeSlug = product || "skybeak";
  const activeProduct = products.find((p) => p.slug === activeSlug) || products[0];

  return (
    <PublicShell>
      {/* Unified Codos Console Header Bar */}
      <section className="bg-[#0A0F1A] text-white border-b border-white/10 py-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-sky-400/30 bg-[#0A192F] px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-sky-300">
              <Terminal className="h-3.5 w-3.5" />
              Codos Console · Unified SaaS Control Plane
            </div>
            <h1 className="font-heading mt-3 text-3xl sm:text-4xl font-extrabold tracking-tight">
              Codos Console Workspace
            </h1>
            <p className="mt-2 text-sm text-slate-300 max-w-2xl">
              Connected seamlessly to Via Codos Corporate — manage Skybeak cloud observability, Thumbs Up APIs keys, and Call Colleague AI voice agents under one unified identity.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/saas"
              className="inline-flex items-center gap-2 rounded-full border border-white/20 px-4 py-2 text-xs font-semibold text-white hover:bg-white/10 transition"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to Via Codos SaaS
            </Link>
            <Link
              href="/portal"
              className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-bold text-[#0A0F1A] hover:bg-sky-50 transition"
            >
              Client Pipeline Portal
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </section>

      {/* Interactive SaaS Switcher & Console Preview */}
      <section className="py-12 bg-[#F8FAFC]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left Sidebar Product Switcher */}
            <aside className="lg:col-span-4 space-y-3">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500 px-1">
                Codos Console Modules
              </div>
              {products.map((p) => {
                const selected = activeProduct?.slug === p.slug;
                return (
                  <Link
                    key={p.id}
                    href={`/codos-console?product=${p.slug}`}
                    className={`block rounded-2xl border p-5 transition ${
                      selected
                        ? "border-[#0A192F] bg-[#0A192F] text-white shadow-lg"
                        : "border-slate-200 bg-white text-[#0A0F1A] hover:border-[#0A192F]"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-heading text-lg font-bold">{p.name}</span>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
                          selected ? "bg-sky-400/20 text-sky-300" : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {p.badge || "Active"}
                      </span>
                    </div>
                    <p className={`mt-1.5 text-xs ${selected ? "text-slate-300" : "text-slate-600"}`}>
                      {p.tagline}
                    </p>
                  </Link>
                );
              })}

              <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-2">
                <div className="text-xs font-bold uppercase tracking-wider text-[#1D4ED8]">
                  Connected Corporate Site
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Need dedicated DevOps, API engineers, or custom AI workflows to extend Codos Console?
                </p>
                <Link
                  href="/staff-augmentation/request"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-[#0A192F] hover:text-[#1D4ED8]"
                >
                  Request Dedicated Engineers →
                </Link>
              </div>
            </aside>

            {/* Right Active Workspace Telemetry Panel */}
            <div className="lg:col-span-8 space-y-6">
              {activeProduct && (
                <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                  <div className="bg-[#0A192F] text-white px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {activeProduct.slug === "skybeak" ? (
                        <span className="inline-flex items-center justify-center rounded-lg bg-white px-1.5 py-1">
                          <img
                            src="/assets/skybeak-logo.png"
                            alt="Skybeak"
                            className="h-6 w-auto object-contain"
                          />
                        </span>
                      ) : activeProduct.slug === "thumbs-up-apis" ? (
                        <span className="inline-flex items-center justify-center rounded-lg bg-white px-1.5 py-1">
                          <img
                            src="/assets/thumbs-up-api-logo.png"
                            alt="Thumbs Up APIs"
                            className="h-6 w-auto object-contain"
                          />
                        </span>
                      ) : activeProduct.slug === "call-colleague" ? (
                        <span className="inline-flex items-center justify-center rounded-lg bg-white px-1.5 py-1">
                          <img
                            src="/assets/call-colleague-logo.png"
                            alt="Call Colleague"
                            className="h-6 w-auto object-contain"
                          />
                        </span>
                      ) : (
                        <PhoneCall className="h-5 w-5 text-sky-300" />
                      )}
                      <div>
                        <div className="font-heading font-bold">{activeProduct.name} Workspace</div>
                        <div className="text-[11px] text-slate-300">
                          console.viacodos.com / {activeProduct.slug}
                        </div>
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 px-3 py-1 text-[11px] font-semibold text-emerald-300">
                      <span className="h-2 w-2 rounded-full bg-emerald-400" />
                      Cluster Healthy
                    </span>
                  </div>

                  <div className="p-6 space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="rounded-xl border border-slate-200 bg-[#F8FAFC] p-4">
                        <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                          <Activity className="h-4 w-4 text-[#1D4ED8]" />
                          30-Day Uptime
                        </div>
                        <div className="font-heading text-2xl font-extrabold text-[#0A0F1A] mt-1">
                          99.99%
                        </div>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-[#F8FAFC] p-4">
                        <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                          <KeyRound className="h-4 w-4 text-[#1D4ED8]" />
                          Tenant Auth
                        </div>
                        <div className="font-heading text-2xl font-extrabold text-[#0A0F1A] mt-1">
                          SSO + RBAC
                        </div>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-[#F8FAFC] p-4">
                        <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                          <CheckCircle2 className="h-4 w-4 text-[#1D4ED8]" />
                          Compliance
                        </div>
                        <div className="font-heading text-2xl font-extrabold text-[#0A0F1A] mt-1">
                          SOC 2 / NDA
                        </div>
                      </div>
                    </div>

                    <div
                      className="vc-prose text-sm"
                      dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(activeProduct.descriptionHtml) }}
                    />

                    <div className="rounded-xl border border-slate-200 bg-[#0A0F1A] p-5 text-slate-200 font-mono text-xs space-y-1.5">
                      <div className="text-sky-400">// Codos Console Quick Provisioning Endpoint</div>
                      <div>POST https://console.viacodos.com/api/v1/workspaces/provision</div>
                      <div className="text-slate-400">
                        {`{ "module": "${activeProduct.slug}", "region": "eu-west-1", "ndaPolicy": "strict" }`}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
                      <Link
                        href={`/saas/${activeProduct.slug}`}
                        className="text-xs font-semibold text-[#1D4ED8] hover:underline"
                      >
                        ← View {activeProduct.name} Product Page
                      </Link>
                      <Link
                        href="/contact"
                        className="inline-flex items-center gap-2 rounded-full bg-[#0A192F] px-5 py-2.5 text-xs font-bold text-white hover:bg-[#1E3A8A] transition"
                      >
                        Request Codos Console Tenant Access
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </PublicShell>
  );
}

