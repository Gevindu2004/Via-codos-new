import React from "react";
import { PublicShell } from "@/components/SiteChrome";
import { PageBanner } from "@/components/PageBanner";

export default function SriLankaAdvantagePage() {
  return (
    <PublicShell>
      <PageBanner
        crumbs={[
          { label: "Why Via Codos", href: "/why/why-us" },
          { label: "The Sri Lanka Advantage" },
        ]}
        eyebrow="Global Tech Hub"
        title="One of the World's Fastest-Growing Tech Hubs"
        subtitle="150,000+ engineers, business-fluent English, and a disciplined STEM university tradition delivering 40–70% cost efficiency."
      />
      <section className="bg-[#0A192F] text-white py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 grid grid-cols-2 lg:grid-cols-4 gap-8 text-center">
          <div>
            <div className="font-heading text-3xl font-extrabold text-sky-300">150,000+</div>
            <div className="text-xs text-slate-300 mt-1">Active Software Engineers</div>
          </div>
          <div>
            <div className="font-heading text-3xl font-extrabold text-white">100,000+</div>
            <div className="text-xs text-slate-300 mt-1">STEM Graduates Annually</div>
          </div>
          <div>
            <div className="font-heading text-3xl font-extrabold text-sky-300">90%+</div>
            <div className="text-xs text-slate-300 mt-1">Business-Fluent English Literacy</div>
          </div>
          <div>
            <div className="font-heading text-3xl font-extrabold text-white">40–70%</div>
            <div className="text-xs text-slate-300 mt-1">Typical Cost Savings</div>
          </div>
        </div>
      </section>
      <section className="py-16 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              title: "Deep Cross-Stack Bench",
              desc: "From modern TypeScript, Python, AI/ML, and Kubernetes to rare legacy COBOL, PL/I, AS/400, and Pick/UniVerse expertise.",
            },
            {
              title: "Lower Attrition & Continuity",
              desc: "High engineer retention preserves institutional knowledge on your codebase over multi-year roadmaps.",
            },
            {
              title: "Business-English Alignment",
              desc: "Direct collaboration in your stand-ups, Slack channels, and sprint demos without translation friction.",
            },
          ].map((b) => (
            <div key={b.title} className="rounded-2xl border border-slate-200 bg-[#F8FAFC] p-6">
              <h2 className="font-heading text-lg font-bold text-[#0A0F1A]">{b.title}</h2>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">{b.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </PublicShell>
  );
}

