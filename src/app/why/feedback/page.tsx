import React from "react";
import { prisma } from "@/lib/prisma";
import { PublicShell } from "@/components/SiteChrome";
import { PageBanner } from "@/components/PageBanner";

export const dynamic = "force-dynamic";

export default async function FeedbackPage() {
  const testimonials = await prisma.testimonial.findMany({
    where: { isVisible: true },
    orderBy: { sortOrder: "asc" },
  });

  return (
    <PublicShell>
      <PageBanner
        crumbs={[{ label: "Why Via Codos", href: "/why/why-us" }, { label: "Client Feedback" }]}
        eyebrow="Client Validation"
        title="Trusted Across Six Time Zones"
        subtitle="What clients across Canada, the USA, Australia, France, and Asia say about partnering with Via Codos."
      />
      <section className="py-16 bg-white">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          {testimonials.map((t) => (
            <article key={t.id} className="rounded-2xl border border-slate-200 bg-[#F8FAFC] p-7 flex flex-col justify-between">
              <p className="text-sm text-slate-700 leading-relaxed italic">&ldquo;{t.quote}&rdquo;</p>
              <div className="mt-6 pt-4 border-t border-slate-200 flex items-center gap-3">
                <img
                  src={t.imageUrl || "/assets/client_1.jpg"}
                  alt={t.name}
                  className="h-11 w-11 rounded-full object-cover border border-slate-300"
                />
                <div>
                  <div className="text-sm font-bold text-[#0A0F1A]">{t.name}</div>
                  <div className="text-xs text-slate-500">
                    {[t.role, t.company, t.country].filter(Boolean).join(" · ")}
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </PublicShell>
  );
}

