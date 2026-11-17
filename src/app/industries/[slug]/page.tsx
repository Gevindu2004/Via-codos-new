import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, CheckCircle2, ArrowRight } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { safeJsonParse } from "@/lib/sanitize";
import { PublicShell } from "@/components/SiteChrome";
import { PageBanner } from "@/components/PageBanner";

export const dynamic = "force-dynamic";

export default async function IndustryDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const industry = await prisma.industry.findUnique({ where: { slug } });
  if (!industry || industry.status !== "PUBLISHED") notFound();

  const challenges = safeJsonParse<string[]>(industry.challengesJson, []);
  const solutions = safeJsonParse<string[]>(industry.solutionsJson, []);

  return (
    <PublicShell>
      <PageBanner
        crumbs={[
          { label: "Industries", href: "/industries" },
          { label: industry.name },
        ]}
        eyebrow="Industry Practice"
        title={industry.name}
        subtitle={industry.intro}
      />

      <section className="py-16 bg-white">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="rounded-2xl border border-slate-200 bg-[#F8FAFC] p-7">
              <div className="flex items-center gap-2 text-sm font-bold text-[#0A0F1A] mb-5">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
                Common Challenges We Solve
              </div>
              <ul className="space-y-3">
                {challenges.map((c, idx) => (
                  <li key={idx} className="flex items-start gap-2.5 text-sm text-slate-700">
                    <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-[#0A192F] shrink-0" />
                    <span>{c}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl border border-[#0A192F] bg-[#0A192F] p-7 text-white shadow-lg">
              <div className="flex items-center gap-2 text-sm font-bold text-sky-300 mb-5">
                <CheckCircle2 className="h-5 w-5" />
                Solutions We Deliver
              </div>
              <ul className="space-y-3">
                {solutions.map((s, idx) => (
                  <li key={idx} className="flex items-start gap-2.5 text-sm text-slate-200">
                    <CheckCircle2 className="h-4 w-4 text-sky-300 mt-0.5 shrink-0" />
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="mt-12 text-center">
            <Link
              href="/staff-augmentation/request"
              className="inline-flex items-center gap-2 rounded-full bg-[#0A192F] px-6 py-3 text-sm font-bold text-white hover:bg-[#1E3A8A] transition"
            >
              Request {industry.name} Specialists
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    </PublicShell>
  );
}

