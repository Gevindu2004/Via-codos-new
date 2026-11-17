import React from "react";
import Link from "next/link";
import { FileText, ShieldCheck, ArrowRight, Calendar } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PublicShell } from "@/components/SiteChrome";
import { PageBanner } from "@/components/PageBanner";

export const dynamic = "force-dynamic";

export default async function LegalIndexPage() {
  const docs = await prisma.legalDocument.findMany({
    where: { isPublic: true, status: "PUBLISHED" },
    include: { type: true },
    orderBy: { title: "asc" },
  });

  return (
    <PublicShell>
      <PageBanner
        crumbs={[{ label: "Legal & Governance" }]}
        eyebrow="Trust Center & Policies"
        title="Legal Documentation & Compliance"
        subtitle="Editable, version-controlled corporate policies, SLAs, Data Processing Agreements, and NDA commitments published directly from our governance repository."
      />

      <section className="py-16 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-10 rounded-2xl border border-[#0A192F]/15 bg-[#F8FAFC] p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <ShieldCheck className="h-6 w-6 text-[#1D4ED8] shrink-0 mt-0.5" />
              <div>
                <h2 className="font-heading text-base font-bold text-[#0A0F1A]">
                  Private Agreement Templates &amp; Client E-Sign
                </h2>
                <p className="text-xs text-slate-600 mt-1">
                  Bilateral NDAs, Master Service Agreements (MSAs), and Staff Augmentation SOWs are issued via secure signing links from our Admin Governance console or your Client Portal pipeline.
                </p>
              </div>
            </div>
            <Link
              href="/contact"
              className="rounded-full bg-[#0A192F] px-5 py-2 text-xs font-semibold text-white hover:bg-[#1E3A8A] shrink-0"
            >
              Request Custom NDA →
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {docs.map((doc) => (
              <Link
                key={doc.id}
                href={`/legal/${doc.slug}`}
                className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:border-[#0A192F] hover:shadow-md transition flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#0A192F]">
                      <FileText className="h-3 w-3 text-[#1D4ED8]" />
                      {doc.type.name}
                    </span>
                    <span className="font-mono text-[11px] font-semibold text-slate-500">
                      v{doc.version}
                    </span>
                  </div>
                  <h3 className="font-heading mt-4 text-lg font-bold text-[#0A0F1A] group-hover:text-[#1D4ED8] transition">
                    {doc.title}
                  </h3>
                  <p className="mt-2 text-sm text-slate-600 line-clamp-3">
                    {doc.summary || "Published corporate governance document."}
                  </p>
                </div>

                <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="inline-flex items-center gap-1 text-slate-500">
                    <Calendar className="h-3.5 w-3.5" />
                    Effective {new Date(doc.effectiveDate).toLocaleDateString()}
                  </span>
                  <span className="font-semibold text-[#0A192F] inline-flex items-center gap-1">
                    Read <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </PublicShell>
  );
}

