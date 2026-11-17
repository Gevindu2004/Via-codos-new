import React from "react";
import Link from "next/link";
import { Award, TrendingUp, Globe, ShieldCheck, ArrowRight } from "lucide-react";
import { PublicShell } from "@/components/SiteChrome";
import { PageBanner } from "@/components/PageBanner";

const FEATURES = [
  {
    icon: Award,
    title: "Top 1% Talent Pool",
    stat: "100+ Pre-Vetted Engineers",
    desc: "Four-stage vetting across technical assessments, live coding challenges, architecture review, and business-English communication.",
  },
  {
    icon: TrendingUp,
    title: "40–70% Cost Efficiency",
    stat: "$15,000+ Avg. Monthly Savings / Pod",
    desc: "Enterprise engineering quality at significant cost savings compared to onshore hiring in the US, UK, EU, or Australia.",
  },
  {
    icon: Globe,
    title: "Global Delivery Experience",
    stat: "200+ Clients Across 6 Continents",
    desc: "Seamless timezone overlap, structured two-week sprint demos, and senior delivery governance.",
  },
  {
    icon: ShieldCheck,
    title: "NDA-First Security & Governance",
    stat: "100% NDA Compliance",
    desc: "Every engagement starts under bilateral NDA with role-based access, encrypted environments, and strict IP ownership.",
  },
];

export default function WhyUsPage() {
  return (
    <PublicShell>
      <PageBanner
        crumbs={[{ label: "Why Via Codos" }]}
        eyebrow="Why Via Codos"
        title="Your Strategic Technology Advantage"
        subtitle="Discover why international enterprises choose Via Codos as their accountable engineering, ERP, and SaaS partner."
      />
      <section className="py-16 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {FEATURES.map((f, i) => (
              <div
                key={f.title}
                className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[#0A192F] text-white">
                      <f.icon className="h-5 w-5" />
                    </div>
                    <span className="font-mono text-xs font-bold text-slate-400">0{i + 1}</span>
                  </div>
                  <h2 className="font-heading mt-4 text-xl font-bold text-[#0A0F1A]">
                    {f.title}
                  </h2>
                  <p className="mt-2 text-sm text-slate-600 leading-relaxed">{f.desc}</p>
                </div>
                <div className="mt-5 pt-4 border-t border-slate-100 text-sm font-bold text-[#1D4ED8]">
                  {f.stat}
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap justify-center gap-3">
            <Link
              href="/why/sri-lanka-advantage"
              className="rounded-full border border-slate-300 px-5 py-2.5 text-xs font-semibold text-[#0A0F1A] hover:border-[#0A192F]"
            >
              The Sri Lanka Advantage →
            </Link>
            <Link
              href="/why/how-we-work"
              className="rounded-full border border-slate-300 px-5 py-2.5 text-xs font-semibold text-[#0A0F1A] hover:border-[#0A192F]"
            >
              How We Work →
            </Link>
            <Link
              href="/why/feedback"
              className="rounded-full bg-[#0A192F] px-5 py-2.5 text-xs font-semibold text-white hover:bg-[#1E3A8A] inline-flex items-center gap-1.5"
            >
              Client Feedback <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </section>
    </PublicShell>
  );
}

