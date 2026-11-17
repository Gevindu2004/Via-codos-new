import React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PublicShell } from "@/components/SiteChrome";
import { PageBanner } from "@/components/PageBanner";
import { DynamicIcon } from "@/components/IconResolver";

export const dynamic = "force-dynamic";

export default async function IndustriesPage() {
  const industries = await prisma.industry.findMany({
    where: { status: "PUBLISHED" },
    orderBy: { sortOrder: "asc" },
  });

  return (
    <PublicShell>
      <PageBanner
        crumbs={[{ label: "Industries" }]}
        eyebrow="Industries"
        title="Solutions for Every Industry"
        subtitle="We deliver industry-specific software, vertical ERPs, and dedicated engineering pods tailored to your operational realities."
      />
      <section className="py-16 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {industries.map((ind) => (
              <Link
                key={ind.id}
                href={`/industries/${ind.slug}`}
                className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:border-[#0A192F] hover:shadow-md transition flex flex-col justify-between"
              >
                <div>
                  <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[#0A192F]/5 text-[#0A192F] group-hover:bg-[#0A192F] group-hover:text-white transition">
                    <DynamicIcon name={ind.icon} className="h-5 w-5" />
                  </div>
                  <h2 className="font-heading mt-4 text-xl font-bold text-[#0A0F1A] group-hover:text-[#1D4ED8] transition">
                    {ind.name}
                  </h2>
                  <p className="mt-2 text-sm text-slate-600 line-clamp-3 leading-relaxed">
                    {ind.intro}
                  </p>
                </div>
                <span className="mt-5 inline-flex items-center gap-1.5 text-xs font-semibold text-[#0A192F]">
                  Explore solutions <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </PublicShell>
  );
}

