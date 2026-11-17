import React from "react";
import { prisma } from "@/lib/prisma";
import { PublicShell } from "@/components/SiteChrome";
import { PageBanner } from "@/components/PageBanner";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const team = await prisma.teamMember.findMany({
    where: { isVisible: true },
    orderBy: { sortOrder: "asc" },
  });

  return (
    <PublicShell>
      <PageBanner
        crumbs={[{ label: "Company", href: "/company/about" }, { label: "Our Team" }]}
        eyebrow="Leadership"
        title="Meet the Experts"
        subtitle="Accountable engineering, AI, and talent leadership overseeing every Via Codos engagement."
      />
      <section className="py-16 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {team.map((m) => (
            <div key={m.id} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm text-center">
              <img
                src={m.imageUrl || "/assets/team_1.jpg"}
                alt={m.name}
                className="h-24 w-24 rounded-full object-cover mx-auto border-2 border-[#0A192F]/15"
              />
              <div className="mt-4 text-[11px] font-bold uppercase tracking-wider text-[#1D4ED8]">
                {m.role}
              </div>
              <h2 className="font-heading mt-1 text-lg font-bold text-[#0A0F1A]">{m.name}</h2>
              <p className="mt-2 text-xs text-slate-600 leading-relaxed">{m.bio}</p>
            </div>
          ))}
        </div>
      </section>
    </PublicShell>
  );
}

