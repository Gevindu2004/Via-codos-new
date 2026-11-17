import React from "react";
import { PublicShell } from "@/components/SiteChrome";
import { PageBanner } from "@/components/PageBanner";

export default function OurPromisePage() {
  const promises = [
    { title: "No Tech Talk", desc: "Plain, accountable executive communication—never hiding behind technical jargon." },
    { title: "No Haggling", desc: "One transparent, fair price quoted upfront with zero scope-creep surprises." },
    { title: "100% Satisfaction Guarantee", desc: "Every deliverable and staff placement is backed by our replacement and satisfaction guarantee." },
  ];
  return (
    <PublicShell>
      <PageBanner
        crumbs={[{ label: "Why Via Codos", href: "/why/why-us" }, { label: "Our Promise" }]}
        eyebrow="Our Promise"
        title="Three Commitments. Every Client. Every Time."
      />
      <section className="py-16 bg-white">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-3 gap-6">
          {promises.map((p) => (
            <div key={p.title} className="rounded-2xl border border-slate-200 bg-[#F8FAFC] p-7">
              <h2 className="font-heading text-xl font-bold text-[#0A0F1A]">{p.title}</h2>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">{p.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </PublicShell>
  );
}

