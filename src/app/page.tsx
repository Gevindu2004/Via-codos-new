import React from "react";
import Link from "next/link";
import {
  ArrowRight,
  Terminal,
  ShieldCheck,
  Users,
  CheckCircle2,
  Building2,
  Layers,
  Sparkles,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { safeJsonParse } from "@/lib/sanitize";
import { PublicShell } from "@/components/SiteChrome";
import { ParallaxLogoHero } from "@/components/ParallaxLogoHero";
import { DynamicIcon } from "@/components/IconResolver";
import { Reveal, CountUpStat } from "@/components/ScrollAnimator";
import { HiringWorkflowDiagram } from "@/components/HiringWorkflowDiagram";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [heroSetting, services, industries, caseStudies, saasProducts, talentCounts, testimonials] =
    await Promise.all([
      prisma.siteSetting.findUnique({ where: { key: "hero" } }),
      prisma.service.findMany({
        where: { status: "PUBLISHED" },
        orderBy: { sortOrder: "asc" },
        select: { id: true, slug: true, name: true, groupName: true, icon: true, oneliner: true },
      }),
      prisma.industry.findMany({
        where: { status: "PUBLISHED" },
        orderBy: { sortOrder: "asc" },
        select: { id: true, slug: true, name: true, icon: true },
      }),
      prisma.caseStudy.findMany({
        where: { status: "PUBLISHED" },
        orderBy: { sortOrder: "asc" },
        select: { id: true, slug: true, name: true, sector: true, headline: true, clientDesc: true, imageUrl: true },
      }),
      prisma.saasProduct.findMany({
        where: { status: "PUBLISHED" },
        orderBy: { sortOrder: "asc" },
        select: { id: true, slug: true, name: true, tagline: true, summary: true, metricsJson: true },
      }),
      prisma.talentProfile.groupBy({
        by: ["category"],
        where: { status: "PUBLISHED", placementStatus: "AVAILABLE" },
        _count: true,
      }),
      prisma.testimonial.findMany({
        where: { isVisible: true },
        orderBy: { sortOrder: "asc" },
        take: 3,
        select: { id: true, name: true, role: true, company: true, country: true, imageUrl: true, quote: true },
      }),
    ]);

  const heroConfig = safeJsonParse<{
    badge?: string;
    eyebrow?: string;
    headline?: string;
    subheadline?: string;
    primaryCtaLabel?: string;
    primaryCtaHref?: string;
    secondaryCtaLabel?: string;
    secondaryCtaHref?: string;
    callouts?: Array<{ label: string; detail: string }>;
  }>(heroSetting?.valueJson, {});

  const itCount = talentCounts.find((t) => t.category === "IT")?._count ?? 20;
  const mgmtCount = talentCounts.find((t) => t.category === "MANAGEMENT")?._count ?? 20;

  return (
    <PublicShell>
      {/* 1. 3D Parallax Logo Hero Section (White / Black / Navy Blue) */}
      <ParallaxLogoHero {...heroConfig} />

      {/* 2. Enterprise Authority & Global Delivery Strip */}
      <section className="bg-[#0A192F] text-white py-10 border-b border-white/10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 items-center">
            <Reveal delay={0}>
              <div className="font-heading text-3xl font-extrabold text-white">
                <CountUpStat end={500} suffix="+" />
              </div>
              <div className="text-xs text-slate-300 mt-1">Global Projects Delivered</div>
            </Reveal>
            <Reveal delay={90}>
              <div className="font-heading text-3xl font-extrabold text-sky-300">
                <CountUpStat end={40} endSecondary={70} suffix="%" />
              </div>
              <div className="text-xs text-slate-300 mt-1">Onshore Engineering Cost Savings</div>
            </Reveal>
            <Reveal delay={180}>
              <div className="font-heading text-3xl font-extrabold text-white">
                <CountUpStat end={itCount + mgmtCount} suffix="+" />
              </div>
              <div className="text-xs text-slate-300 mt-1">
                Anonymized IT, Legacy &amp; Management Profiles
              </div>
            </Reveal>
            <Reveal delay={270}>
              <div className="font-heading text-3xl font-extrabold text-sky-300">
                <CountUpStat end={100} suffix="%" />
              </div>
              <div className="text-xs text-slate-300 mt-1">NDA-First Security &amp; E-Sign Governance</div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* 3. Codos Console SaaS Products Section (Skybeak, Thumbs Up APIs, Call Colleague) */}
      <section className="py-20 bg-[#F8FAFC] border-b border-slate-200 overflow-hidden">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Reveal>
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
              <div>
                <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-[#1D4ED8]">
                  <Terminal className="h-4 w-4" />
                  SaaS Products &amp; Codos Console
                </span>
                <h2 className="font-heading mt-2 text-3xl sm:text-4xl font-extrabold text-[#0A0F1A] tracking-tight">
                  Enterprise Cloud Software, Unified in Codos Console
                </h2>
                <p className="mt-3 text-slate-600 max-w-2xl">
                  Explore our proprietary SaaS products built for observability, API infrastructure, and 24/7 conversational AI — each launching directly into Codos Console.
                </p>
              </div>
              <Link
                href="/codos-console"
                className="inline-flex items-center gap-2 rounded-full bg-[#0A192F] px-5 py-2.5 text-xs font-semibold text-white hover:bg-[#1E3A8A] transition shrink-0"
              >
                Open Codos Console
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </Reveal>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {saasProducts.map((product, idx) => {
              const metrics = safeJsonParse<Array<{ value: string; label: string }>>(
                product.metricsJson,
                []
              );
              return (
                <Reveal key={product.id} delay={idx * 100} className="h-full">
                  <Link
                    href={`/saas/${product.slug}`}
                    className="group relative h-full flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-7 shadow-sm transition hover:-translate-y-1 hover:border-[#0A192F] hover:shadow-xl"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-3 min-h-[44px]">
                        {product.slug === "skybeak" ? (
                          <img
                            src="/assets/skybeak-logo.png"
                            alt="Skybeak logo"
                            className="h-11 w-auto object-contain"
                          />
                        ) : product.slug === "thumbs-up-apis" ? (
                          <img
                            src="/assets/thumbs-up-api-logo.png"
                            alt="Thumbs Up APIs logo"
                            className="h-11 w-auto object-contain"
                          />
                        ) : product.slug === "call-colleague" ? (
                          <img
                            src="/assets/call-colleague-logo.png"
                            alt="Call Colleague logo"
                            className="h-12 w-auto object-contain"
                          />
                        ) : (
                          <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[#0A192F]/5 text-[#0A192F] group-hover:bg-[#0A192F] group-hover:text-white transition">
                            <DynamicIcon name="code" className="h-5 w-5" />
                          </span>
                        )}
                        <span className="text-xs font-mono text-[#1D4ED8] group-hover:translate-x-0.5 transition">
                          Codos Console →
                        </span>
                      </div>
                      <h3 className="font-heading mt-4 text-2xl font-bold text-[#0A0F1A] group-hover:text-[#1D4ED8] transition">
                        {product.name}
                      </h3>
                      <p className="mt-1 text-xs font-semibold text-[#1E3A8A]">{product.tagline}</p>
                      <p className="mt-3 text-sm text-slate-600 leading-relaxed">{product.summary}</p>
                    </div>

                    <div className="mt-6 pt-5 border-t border-slate-100 flex items-center justify-between">
                      {metrics[0] ? (
                        <div>
                          <span className="font-heading text-lg font-extrabold text-[#0A192F]">
                            {metrics[0].value}
                          </span>
                          <span className="ml-2 text-xs text-slate-500">{metrics[0].label}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-500">Enterprise Ready</span>
                      )}
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-[#0A192F] group-hover:bg-[#0A192F] group-hover:text-white transition">
                        <ArrowRight className="h-4 w-4" />
                      </span>
                    </div>
                  </Link>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* 4. Staff Augmentation & Anonymized Talent Bench Highlight */}
      <section className="py-20 bg-white border-b border-slate-200 overflow-hidden">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <Reveal direction="right" className="lg:col-span-6 space-y-5">
              <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-[#1D4ED8]">
                <Users className="h-4 w-4" />
                Staff Augmentation &amp; Talent Bench
              </span>
              <h2 className="font-heading text-3xl sm:text-4xl font-extrabold text-[#0A0F1A] tracking-tight">
                Pre-Vetted IT, Legacy &amp; Management Talent — Anonymized Until Approved
              </h2>
              <p className="text-slate-600 leading-relaxed">
                Browse {itCount} specialized IT profiles (including Full-Stack, DevOps, AI/ML, Cybersecurity, Data Science, plus rare COBOL, PL/I, IBM Mainframe, AS/400, and Pick/UniVerse engineers) alongside {mgmtCount} senior Management profiles in Logistics, Accounting, Project Management, and Operations.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                {[
                  "Request Full Profile with Admin Approval",
                  "In-Browser AI Interviewer + Transcripts",
                  "3-Way Meet via Codos Management",
                  "Integrated PDF E-Sign & Placement",
                ].map((item) => (
                  <div key={item} className="flex items-start gap-2.5 text-sm text-[#0A0F1A] font-medium">
                    <CheckCircle2 className="h-4 w-4 text-[#1D4ED8] mt-0.5 shrink-0" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>

              <div className="pt-4 flex flex-wrap gap-3">
                <Link
                  href="/talent"
                  className="inline-flex items-center gap-2 rounded-full bg-[#0A192F] px-6 py-3 text-sm font-semibold text-white hover:bg-[#1E3A8A] transition"
                >
                  Browse Talent Bench
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/staff-augmentation/request"
                  className="inline-flex items-center gap-2 rounded-full border border-slate-300 px-6 py-3 text-sm font-semibold text-[#0A0F1A] hover:border-[#0A192F] transition"
                >
                  Submit Engineer Request
                </Link>
              </div>
            </Reveal>

            <Reveal direction="left" delay={120} className="lg:col-span-6">
              <HiringWorkflowDiagram />
            </Reveal>
          </div>
        </div>
      </section>

      {/* 5. All 15 Comprehensive IT Services (Preserved & CMS Managed) */}
      <section className="py-20 bg-[#F8FAFC] border-b border-slate-200 overflow-hidden">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Reveal>
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
              <div>
                <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-[#1D4ED8]">
                  <Layers className="h-4 w-4" />
                  Our Services
                </span>
                <h2 className="font-heading mt-2 text-3xl sm:text-4xl font-extrabold text-[#0A0F1A] tracking-tight">
                  Comprehensive Enterprise IT Services
                </h2>
                <p className="mt-3 text-slate-600 max-w-2xl">
                  Fifteen specialized service lines — flagship vertical ERPs, custom engineering, AI automation, and dedicated talent.
                </p>
              </div>
              <Link
                href="/services"
                className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-5 py-2.5 text-xs font-semibold text-[#0A0F1A] hover:border-[#0A192F] transition shrink-0"
              >
                View All 15 Services
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </Reveal>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {services.map((s, idx) => (
              <Reveal key={s.id} delay={(idx % 3) * 80} className="h-full">
                <Link
                  href={`/services/${s.slug}`}
                  className="group h-full rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-[#0A192F] hover:shadow-md flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[#0A192F]/5 text-[#0A192F] group-hover:bg-[#0A192F] group-hover:text-white transition">
                        <DynamicIcon name={s.icon} className="h-5 w-5" />
                      </span>
                      <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                        {s.groupName}
                      </span>
                    </div>
                    <h3 className="font-heading mt-4 text-lg font-bold text-[#0A0F1A] group-hover:text-[#1D4ED8] transition">
                      {s.name}
                    </h3>
                    <p className="mt-2 text-sm text-slate-600 line-clamp-3 leading-relaxed">
                      {s.oneliner}
                    </p>
                  </div>
                  <div className="mt-5 inline-flex items-center gap-1.5 text-xs font-semibold text-[#0A192F] group-hover:text-[#1D4ED8]">
                    <span>Learn more</span>
                    <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
                  </div>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* 6. Industries Band (Dark Navy Enterprise Showcase) */}
      <section className="py-20 bg-[#0A192F] text-white overflow-hidden">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Reveal>
            <div className="text-center max-w-2xl mx-auto mb-12">
              <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-sky-300">
                <Building2 className="h-4 w-4" />
                Industries We Serve
              </span>
              <h2 className="font-heading mt-2 text-3xl sm:text-4xl font-extrabold tracking-tight">
                Built for How Your Industry Actually Runs
              </h2>
              <p className="mt-3 text-slate-300 text-sm sm:text-base">
                Domain-specific operational credibility across 12 regulated and high-growth sectors.
              </p>
            </div>
          </Reveal>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3.5">
            {industries.map((ind, idx) => (
              <Reveal key={ind.id} delay={(idx % 4) * 60}>
                <Link
                  href={`/industries/${ind.slug}`}
                  className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3.5 text-sm font-medium text-white hover:bg-white/10 hover:border-sky-300/40 transition"
                >
                  <DynamicIcon name={ind.icon} className="h-4 w-4 text-sky-300 shrink-0" />
                  <span className="truncate">{ind.name}</span>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* 7. Featured Case Studies */}
      <section className="py-20 bg-white border-b border-slate-200 overflow-hidden">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Reveal>
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
              <div>
                <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-[#1D4ED8]">
                  <Sparkles className="h-4 w-4" />
                  Portfolio &amp; Case Studies
                </span>
                <h2 className="font-heading mt-2 text-3xl sm:text-4xl font-extrabold text-[#0A0F1A] tracking-tight">
                  Flagship Products, Measurable Outcomes
                </h2>
              </div>
              <Link
                href="/portfolio"
                className="inline-flex items-center gap-2 text-xs font-semibold text-[#0A192F] hover:text-[#1D4ED8]"
              >
                Explore All Case Studies <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </Reveal>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-7">
            {caseStudies.map((c, idx) => (
              <Reveal key={c.id} delay={(idx % 2) * 110} className="h-full">
                <Link
                  href={`/portfolio/${c.slug}`}
                  className="group block h-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:shadow-lg hover:border-[#0A192F]"
                >
                  <div className="aspect-video bg-[#0A192F] relative overflow-hidden">
                    <img
                      src={c.imageUrl}
                      alt={c.name}
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-cover opacity-90 transition duration-500 group-hover:scale-105"
                    />
                    <span className="absolute top-4 left-4 rounded-full bg-[#0A0F1A]/85 px-3 py-1 text-[11px] font-semibold text-white">
                      {c.sector}
                    </span>
                  </div>
                  <div className="p-6">
                    <h3 className="font-heading text-xl font-bold text-[#0A0F1A] group-hover:text-[#1D4ED8] transition">
                      {c.name}
                    </h3>
                    <p className="mt-1.5 text-sm font-medium text-[#1E3A8A]">{c.headline}</p>
                    <p className="mt-2.5 text-sm text-slate-600 line-clamp-2">{c.clientDesc}</p>
                    <span className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-[#0A0F1A]">
                      Read case study <ArrowRight className="h-3.5 w-3.5" />
                    </span>
                  </div>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* 8. Client Testimonials */}
      <section className="py-20 bg-[#F8FAFC] border-b border-slate-200 overflow-hidden">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Reveal>
            <div className="text-center max-w-2xl mx-auto mb-12">
              <span className="text-xs font-bold uppercase tracking-[0.18em] text-[#1D4ED8]">
                Client Validation
              </span>
              <h2 className="font-heading mt-2 text-3xl font-extrabold text-[#0A0F1A]">
                Trusted Across Six Time Zones
              </h2>
            </div>
          </Reveal>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map((t, idx) => (
              <Reveal key={t.id} delay={idx * 100} className="h-full">
                <div className="h-full rounded-2xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col justify-between">
                  <p className="text-sm text-slate-700 leading-relaxed italic">
                    &ldquo;{t.quote}&rdquo;
                  </p>
                  <div className="mt-6 pt-4 border-t border-slate-100 flex items-center gap-3">
                    <img
                      src={t.imageUrl || "/assets/client_1.jpg"}
                      alt={t.name}
                      loading="lazy"
                      decoding="async"
                      className="h-10 w-10 rounded-full object-cover border border-slate-200"
                    />
                    <div>
                      <div className="text-sm font-bold text-[#0A0F1A]">{t.name}</div>
                      <div className="text-xs text-slate-500">
                        {[t.role, t.company, t.country].filter(Boolean).join(" · ")}
                      </div>
                    </div>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* 9. Final Enterprise CTA Band */}
      <section className="py-20 bg-[#0A0F1A] text-white overflow-hidden">
        <Reveal direction="scale">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3.5 py-1 text-xs font-semibold text-sky-300 mb-5">
              <ShieldCheck className="h-4 w-4" />
              NDA-First · Fixed Transparency · 100% Satisfaction Commitment
            </div>
            <h2 className="font-heading text-3xl sm:text-4xl font-extrabold tracking-tight">
              Ready to Scale Your Engineering or Operations Team?
            </h2>
            <p className="mt-4 text-slate-300 text-base max-w-2xl mx-auto">
              Submit a structured staff augmentation request, browse our anonymized bench, or launch your SaaS workflows in Codos Console today.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              <Link
                href="/staff-augmentation/request"
                className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-bold text-[#0A0F1A] hover:bg-sky-50 transition"
              >
                Request Engineers Now
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/contact"
                className="inline-flex items-center gap-2 rounded-full border border-white/25 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10 transition"
              >
                Book a Free Consultation
              </Link>
            </div>
          </div>
        </Reveal>
      </section>
    </PublicShell>
  );
}
