import React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PublicShell } from "@/components/SiteChrome";
import { PageBanner } from "@/components/PageBanner";

interface CaseStudiesDirectoryProps {
  crumbLabel: string;
  eyebrow: string;
  title: string;
  subtitle: string;
}

export async function CaseStudiesDirectory({
  crumbLabel,
  eyebrow,
  title,
  subtitle,
}: CaseStudiesDirectoryProps) {
  const cases = await prisma.caseStudy.findMany({
    where: { status: "PUBLISHED" },
    orderBy: { sortOrder: "asc" },
  });

  return (
    <PublicShell>
      <PageBanner
        crumbs={[{ label: crumbLabel }]}
        eyebrow={eyebrow}
        title={title}
        subtitle={subtitle}
      />
      <section className="py-16 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-2 gap-8">
          {cases.map((c) => (
            <Link
              key={c.id}
              href={`/portfolio/${c.slug}`}
              className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm hover:border-[#0A192F] hover:shadow-lg transition"
            >
              <div className="aspect-video bg-[#0A192F] relative overflow-hidden">
                <img
                  src={c.imageUrl}
                  alt={c.name}
                  className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                />
                <span className="absolute top-4 left-4 rounded-full bg-[#0A0F1A]/85 px-3 py-1 text-[11px] font-semibold text-white">
                  {c.sector}
                </span>
              </div>
              <div className="p-6">
                <h2 className="font-heading text-2xl font-bold text-[#0A0F1A] group-hover:text-[#1D4ED8] transition">
                  {c.name}
                </h2>
                <p className="mt-1.5 text-sm font-medium text-[#1E3A8A]">{c.headline}</p>
                <p className="mt-2.5 text-sm text-slate-600 line-clamp-2">{c.clientDesc}</p>
                <span className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-[#0A0F1A]">
                  Read case study <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </PublicShell>
  );
}

