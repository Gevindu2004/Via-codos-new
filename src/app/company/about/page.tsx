import React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { safeJsonParse, sanitizeRichHtml } from "@/lib/sanitize";
import { PublicShell } from "@/components/SiteChrome";
import { PageBanner } from "@/components/PageBanner";

export const dynamic = "force-dynamic";

export default async function AboutPage() {
  const cmsPage = await prisma.cmsPage.findUnique({
    where: { slug: "about" },
    include: { sections: { where: { isVisible: true }, orderBy: { sortOrder: "asc" } } },
  });

  const richSection = cmsPage?.sections.find((s) => s.type === "RICH_TEXT");
  const statsSection = cmsPage?.sections.find((s) => s.type === "STATS_GRID");
  const stats = safeJsonParse<Array<{ value: string; label: string }>>(statsSection?.dataJson, [
    { value: "500+", label: "Projects Completed" },
    { value: "200+", label: "Clients Worldwide" },
    { value: "40–70%", label: "Cost Savings" },
    { value: "100+", label: "Pre-Vetted Engineers" },
  ]);

  return (
    <PublicShell>
      <PageBanner
        crumbs={[{ label: "Company" }, { label: "About Us" }]}
        eyebrow="About Via Codos"
        title={cmsPage?.title || "We Take Care of Your IT. So You May Focus on Your Business."}
        subtitle={cmsPage?.subtitle || undefined}
      />

      <section className="py-16 bg-white">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-12">
          <div className="lg:col-span-8">
            <div
              className="vc-prose"
              dangerouslySetInnerHTML={{
                __html: sanitizeRichHtml(
                  richSection?.bodyHtml ||
                    "<p>Via Codos bridges global businesses with top Sri Lankan engineering and management talent.</p>"
                ),
              }}
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mt-8">
              <div className="rounded-2xl border border-slate-200 bg-[#F8FAFC] p-6">
                <h3 className="font-heading text-lg font-bold text-[#0A192F]">Mission</h3>
                <p className="mt-2 text-sm text-slate-600">
                  To connect global enterprises with vetted engineering and operational specialists, delivering software and SaaS platforms that drive measurable growth.
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-[#F8FAFC] p-6">
                <h3 className="font-heading text-lg font-bold text-[#0A192F]">Vision</h3>
                <p className="mt-2 text-sm text-slate-600">
                  To be the most trusted bridge between international organizations and South Asia&apos;s top technology ecosystem.
                </p>
              </div>
            </div>
          </div>

          <aside className="lg:col-span-4">
            <div className="rounded-2xl bg-[#0A192F] p-7 text-white shadow-lg space-y-4">
              <div className="font-heading text-3xl font-extrabold text-sky-300">Sept 2024</div>
              <div className="text-xs text-slate-300 pb-4 border-b border-white/15">
                Established in Galle, Sri Lanka — Serving Worldwide
              </div>
              <h4 className="font-heading text-lg font-bold">Meet the Leadership Team</h4>
              <p className="text-sm text-slate-300">
                Senior leadership across software architecture, AI automation, and talent vetting.
              </p>
              <Link
                href="/company/team"
                className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-xs font-bold text-[#0A0F1A] hover:bg-sky-50"
              >
                Meet Our Team <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </aside>
        </div>
      </section>

      <section className="py-14 bg-[#0A0F1A] text-white">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 grid grid-cols-2 lg:grid-cols-4 gap-8 text-center">
          {stats.map((s) => (
            <div key={s.label}>
              <div className="font-heading text-3xl font-extrabold text-sky-300">{s.value}</div>
              <div className="text-xs text-slate-300 mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </section>
    </PublicShell>
  );
}

