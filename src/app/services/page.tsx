import React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PublicShell } from "@/components/SiteChrome";
import { PageBanner } from "@/components/PageBanner";
import { DynamicIcon } from "@/components/IconResolver";

export const dynamic = "force-dynamic";

const GROUPS = [
  {
    name: "Talent & Products",
    desc: "Dedicated engineering talent and the flagship vertical products we build and run.",
  },
  {
    name: "Custom Development",
    desc: "What we design and engineer from the ground up, around your operational workflow.",
  },
  {
    name: "Run & Scale",
    desc: "Cloud, AI, QA, data, and security engineering that keep systems reliable as you grow.",
  },
];

export default async function ServicesPage() {
  const services = await prisma.service.findMany({
    where: { status: "PUBLISHED" },
    orderBy: { sortOrder: "asc" },
  });

  return (
    <PublicShell>
      <PageBanner
        crumbs={[{ label: "Services" }]}
        eyebrow="Our Services"
        title="Comprehensive IT Solutions"
        subtitle="From custom software and vertical ERPs to AI automation and staff augmentation — fifteen service lines, one accountable partner."
      />

      <section className="py-16 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-16">
          {GROUPS.map((grp) => {
            const items = services.filter((s) => s.groupName === grp.name);
            if (items.length === 0) return null;
            return (
              <div key={grp.name}>
                <div className="border-b border-slate-200 pb-4 mb-8">
                  <span className="text-xs font-bold uppercase tracking-[0.18em] text-[#1D4ED8]">
                    {grp.name}
                  </span>
                  <h2 className="font-heading mt-1 text-2xl font-bold text-[#0A0F1A]">
                    {grp.desc}
                  </h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {items.map((s) => (
                    <Link
                      key={s.id}
                      href={`/services/${s.slug}`}
                      className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-[#0A192F] hover:shadow-md flex flex-col justify-between"
                    >
                      <div>
                        <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[#0A192F]/5 text-[#0A192F] group-hover:bg-[#0A192F] group-hover:text-white transition">
                          <DynamicIcon name={s.icon} className="h-5 w-5" />
                        </div>
                        <h3 className="font-heading mt-4 text-lg font-bold text-[#0A0F1A] group-hover:text-[#1D4ED8] transition">
                          {s.name}
                        </h3>
                        <p className="mt-2 text-sm text-slate-600 leading-relaxed">{s.oneliner}</p>
                      </div>
                      <span className="mt-5 inline-flex items-center gap-1.5 text-xs font-semibold text-[#0A192F] group-hover:text-[#1D4ED8]">
                        Learn more <ArrowRight className="h-3.5 w-3.5" />
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </PublicShell>
  );
}

