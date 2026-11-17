import React from "react";
import { PublicShell } from "@/components/SiteChrome";
import { PageBanner } from "@/components/PageBanner";

export default function HowWeWorkPage() {
  const steps = [
    { num: "01", title: "Quick Response", desc: "Initial response within 12 seconds during business hours and within one business day outside them." },
    { num: "02", title: "Remote-First Resolution", desc: "Structured remote sprint delivery and engineering support that keeps velocity high and overhead low." },
    { num: "03", title: "On-Site Coordination", desc: "When physical presence is genuinely needed, we coordinate structured on-site support." },
    { num: "04", title: "Security & Backup First", desc: "Bilateral NDA, encrypted credentials, and audit-ready governance built in from day one." },
  ];
  return (
    <PublicShell>
      <PageBanner
        crumbs={[{ label: "Why Via Codos", href: "/why/why-us" }, { label: "How We Work" }]}
        eyebrow="Delivery Process"
        title="An Engagement You Never Have to Chase"
      />
      <section className="py-16 bg-white">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          {steps.map((s) => (
            <div key={s.num} className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
              <span className="font-mono text-xs font-bold text-[#1D4ED8]">STEP {s.num}</span>
              <h2 className="font-heading mt-2 text-xl font-bold text-[#0A0F1A]">{s.title}</h2>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </PublicShell>
  );
}

