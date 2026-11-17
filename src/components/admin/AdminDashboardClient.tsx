"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard,
  FileText,
  Layers,
  Menu,
  Scale,
  Users,
  Briefcase,
  History,
  LogOut,
  ExternalLink,
} from "lucide-react";
import { ViaCodosLogo } from "@/components/ViaCodosLogo";
import {
  AdminPagesBuilderPanel,
  AdminCatalogEditorPanel,
  AdminMenusMediaPanel,
} from "./AdminCmsPanels";
import { AdminLegalPanel } from "./AdminLegalPanel";
import {
  AdminTalentPipelinePanel,
  AdminCareersScreeningPanel,
} from "./AdminTalentPipelinePanel";

type AdminTab =
  | "OVERVIEW"
  | "PAGES"
  | "CATALOG"
  | "MENUS_MEDIA"
  | "LEGAL"
  | "PIPELINE"
  | "CAREERS"
  | "AUDIT";

export function AdminDashboardClient({
  adminEmail,
  adminRole,
}: {
  adminEmail: string;
  adminRole: string;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<AdminTab>("OVERVIEW");
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

  const [contentData, setContentData] = useState<any>({
    pages: [],
    categories: [],
    menus: [],
    settings: [],
    services: [],
    industries: [],
    caseStudies: [],
    insights: [],
    saasProducts: [],
    media: [],
  });
  const [legalData, setLegalData] = useState<any>({
    types: [],
    documents: [],
    signatureRequests: [],
  });
  const [talentData, setTalentData] = useState<any>({
    profiles: [],
    domains: [],
    metrics: {},
  });
  const [pipelineData, setPipelineData] = useState<any>({
    clients: [],
    requests: [],
    inquiries: [],
  });
  const [careersData, setCareersData] = useState<any>({
    domains: [],
    postings: [],
    applications: [],
    sampleProfiles: [],
  });
  const [auditData, setAuditData] = useState<any>({ auditLogs: [], emails: [] });

  const notify = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4500);
  };

  const loadAll = async () => {
    setLoading(true);
    try {
      const [c, l, t, p, ca, au] = await Promise.all([
        fetch("/api/admin/content").then((r) => r.json()),
        fetch("/api/admin/legal").then((r) => r.json()),
        fetch("/api/admin/talent").then((r) => r.json()),
        fetch("/api/admin/pipeline").then((r) => r.json()),
        fetch("/api/admin/careers").then((r) => r.json()),
        fetch("/api/admin/audit").then((r) => r.json()),
      ]);
      setContentData(c);
      setLegalData(l);
      setTalentData(t);
      setPipelineData(p);
      setCareersData(ca);
      setAuditData(au);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const handleLogout = async () => {
    await fetch("/api/admin/auth/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  };

  const NAV_ITEMS: Array<{ id: AdminTab; label: string; icon: any }> = [
    { id: "OVERVIEW", label: "Overview", icon: LayoutDashboard },
    { id: "PAGES", label: "Pages & Categories", icon: FileText },
    { id: "CATALOG", label: "Services, SaaS & Content", icon: Layers },
    { id: "MENUS_MEDIA", label: "Menus, Hero & Media", icon: Menu },
    { id: "LEGAL", label: "Legal & E-Sign", icon: Scale },
    { id: "PIPELINE", label: "Client Pipeline & Talent", icon: Users },
    { id: "CAREERS", label: "Careers & Screening", icon: Briefcase },
    { id: "AUDIT", label: "Audit Log & Emails", icon: History },
  ];

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col">
      {/* Top Admin Bar */}
      <header className="sticky top-0 z-40 bg-[#0A192F] text-white border-b border-white/10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/">
              <ViaCodosLogo dark size={32} />
            </Link>
            <span className="hidden sm:inline-block rounded-full bg-white/10 px-3 py-0.5 text-[11px] font-bold uppercase tracking-wider text-sky-300">
              Admin CMS &amp; Operations
            </span>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <span className="hidden md:inline text-slate-300">
              {adminEmail} ({adminRole})
            </span>
            <Link
              href="/"
              target="_blank"
              className="inline-flex items-center gap-1 rounded-full border border-white/20 px-3 py-1.5 hover:bg-white/10"
            >
              View Live Site <ExternalLink className="h-3 w-3" />
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1.5 hover:bg-white/20"
            >
              <LogOut className="h-3.5 w-3.5" /> Sign Out
            </button>
          </div>
        </div>
      </header>

      {toast && (
        <div className="fixed bottom-5 right-5 z-50 rounded-xl bg-[#0A192F] text-white px-5 py-3 text-xs font-semibold shadow-2xl border border-sky-400/30">
          ✓ {toast}
        </div>
      )}

      <div className="mx-auto max-w-7xl w-full px-4 sm:px-6 lg:px-8 py-8 flex-1 grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Sidebar Tabs */}
        <aside className="lg:col-span-3 space-y-1.5">
          {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`w-full flex items-center gap-2.5 rounded-xl px-4 py-3 text-xs font-semibold transition text-left ${
                tab === id
                  ? "bg-[#0A192F] text-white shadow-md"
                  : "bg-white border border-slate-200 text-slate-700 hover:border-[#0A192F]"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span>{label}</span>
            </button>
          ))}
        </aside>

        {/* Main Workspace */}
        <main className="lg:col-span-9">
          {loading ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-500">
              Loading Admin CMS Workspace...
            </div>
          ) : (
            <>
              {tab === "OVERVIEW" && (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {[
                      { label: "Services", val: contentData.services?.length || 0 },
                      { label: "SaaS Products", val: contentData.saasProducts?.length || 0 },
                      {
                        label: "Talent Bench",
                        val: `${talentData.metrics?.totalPublished || 0} (${
                          talentData.metrics?.realRatioPct || 0
                        }% Real)`,
                      },
                      {
                        label: "Pending Screening",
                        val:
                          careersData.applications?.filter(
                            (a: any) => a.screeningStatus !== "CONVERTED"
                          ).length || 0,
                      },
                      { label: "Legal Docs & Templates", val: legalData.documents?.length || 0 },
                      {
                        label: "Signed Agreements",
                        val:
                          legalData.signatureRequests?.filter((s: any) => s.status === "SIGNED")
                            .length || 0,
                      },
                      { label: "Client Accounts", val: pipelineData.clients?.length || 0 },
                      { label: "Audit Events", val: auditData.auditLogs?.length || 0 },
                    ].map((stat) => (
                      <div
                        key={stat.label}
                        className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                      >
                        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                          {stat.label}
                        </div>
                        <div className="font-heading text-2xl font-extrabold text-[#0A192F] mt-1">
                          {stat.val}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-6">
                    <h2 className="font-heading text-lg font-bold text-[#0A0F1A] mb-3">
                      Recent Audit Activity
                    </h2>
                    <div className="divide-y divide-slate-100">
                      {(auditData.auditLogs || []).slice(0, 8).map((log: any) => (
                        <div key={log.id} className="py-2.5 flex items-center justify-between text-xs">
                          <div>
                            <span className="font-mono text-[10px] font-bold bg-slate-100 px-2 py-0.5 rounded mr-2">
                              {log.action}
                            </span>
                            <span className="text-slate-700">{log.summary}</span>
                          </div>
                          <span className="text-slate-400 shrink-0 ml-3">{log.actorEmail}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {tab === "PAGES" && (
                <AdminPagesBuilderPanel
                  pages={contentData.pages}
                  categories={contentData.categories}
                  onReload={loadAll}
                  notify={notify}
                />
              )}

              {tab === "CATALOG" && (
                <AdminCatalogEditorPanel
                  services={contentData.services}
                  industries={contentData.industries}
                  caseStudies={contentData.caseStudies}
                  insights={contentData.insights}
                  saasProducts={contentData.saasProducts}
                  onReload={loadAll}
                  notify={notify}
                />
              )}

              {tab === "MENUS_MEDIA" && (
                <AdminMenusMediaPanel
                  menus={contentData.menus}
                  settings={contentData.settings}
                  media={contentData.media}
                  onReload={loadAll}
                  notify={notify}
                />
              )}

              {tab === "LEGAL" && (
                <AdminLegalPanel
                  types={legalData.types}
                  documents={legalData.documents}
                  signatureRequests={legalData.signatureRequests}
                  onReload={loadAll}
                  notify={notify}
                />
              )}

              {tab === "PIPELINE" && (
                <AdminTalentPipelinePanel
                  clients={pipelineData.clients}
                  requests={pipelineData.requests}
                  inquiries={pipelineData.inquiries}
                  talentData={talentData}
                  onReload={loadAll}
                  notify={notify}
                />
              )}

              {tab === "CAREERS" && (
                <AdminCareersScreeningPanel
                  careersData={careersData}
                  talentMetrics={talentData.metrics}
                  onReload={loadAll}
                  notify={notify}
                />
              )}

              {tab === "AUDIT" && (
                <div className="space-y-6">
                  <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-3">
                    <h3 className="font-heading text-base font-bold text-[#0A0F1A]">
                      Audit Log — Who Changed What ({auditData.auditLogs?.length || 0})
                    </h3>
                    <div className="divide-y divide-slate-100 max-h-[420px] overflow-y-auto">
                      {(auditData.auditLogs || []).map((log: any) => (
                        <div key={log.id} className="py-3 text-xs space-y-1">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <span className="font-mono text-[10px] font-bold bg-[#0A192F] text-white px-2 py-0.5 rounded mr-2">
                                {log.action}
                              </span>
                              <span className="font-semibold text-[#1D4ED8] mr-2">
                                {log.entityType}
                              </span>
                              <span className="font-bold text-[#0A0F1A]">{log.entityLabel}</span>
                            </div>
                            <span className="text-slate-400">
                              {new Date(log.createdAt).toLocaleString()}
                            </span>
                          </div>
                          <div className="text-slate-600">
                            {log.summary} — <strong>Actor:</strong> {log.actorEmail} ({log.actorRole})
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-3">
                    <h3 className="font-heading text-base font-bold text-[#0A0F1A]">
                      Email Outbox &amp; Signed Agreement Dispatch Log ({auditData.emails?.length || 0})
                    </h3>
                    <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
                      {(auditData.emails || []).map((em: any) => (
                        <div key={em.id} className="py-3 text-xs space-y-1">
                          <div className="flex items-center justify-between">
                            <strong>{em.subject}</strong>
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 font-mono text-[10px] font-bold">
                              {em.status}
                            </span>
                          </div>
                          <div className="text-slate-600">
                            To: {em.toEmail} {em.ccEmail ? `| CC: ${em.ccEmail}` : ""}
                            {em.attachmentPath ? ` | Attachment: ${em.attachmentPath}` : ""}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}

