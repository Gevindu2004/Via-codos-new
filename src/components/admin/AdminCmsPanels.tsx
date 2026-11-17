"use client";

import React, { useState } from "react";
import {
  History,
  RotateCcw,
  Upload,
  Plus,
  Trash2,
  ExternalLink,
  Check,
} from "lucide-react";
import { RichTextEditor } from "@/components/RichTextEditor";

interface VersionItem {
  id: string;
  entityType: string;
  entityId: string;
  versionNumber: number;
  changeNote: string | null;
  createdByEmail: string;
  createdAt: string;
}

export function VersionHistoryModal({
  entityType,
  entityId,
  title,
  onClose,
  onRolledBack,
}: {
  entityType: string;
  entityId: string;
  title: string;
  onClose: () => void;
  onRolledBack: () => void;
}) {
  const [versions, setVersions] = useState<VersionItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  React.useEffect(() => {
    fetch(`/api/admin/versions?entityType=${entityType}&entityId=${entityId}`)
      .then((r) => r.json())
      .then((d) => {
        setVersions(d.versions || []);
        setLoaded(true);
      });
  }, [entityType, entityId]);

  const handleRollback = async (versionId: string) => {
    const res = await fetch("/api/admin/versions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ versionId }),
    });
    if (res.ok) {
      onRolledBack();
      onClose();
    } else {
      alert("Rollback failed.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b pb-3">
          <div className="flex items-center gap-2 font-heading font-bold text-[#0A0F1A]">
            <History className="h-5 w-5 text-[#1D4ED8]" />
            Version History — {title}
          </div>
          <button type="button" onClick={onClose} className="text-xs font-semibold text-slate-500">
            Close
          </button>
        </div>
        {!loaded ? (
          <div className="text-xs text-slate-500 py-6 text-center">Loading versions...</div>
        ) : versions.length === 0 ? (
          <div className="text-xs text-slate-500 py-6 text-center">
            No saved version snapshots yet. Save an edit to start tracking versions.
          </div>
        ) : (
          <div className="space-y-2.5">
            {versions.map((v) => (
              <div
                key={v.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3 text-xs"
              >
                <div>
                  <div className="font-bold text-[#0A192F]">
                    Version #{v.versionNumber} — {v.changeNote || "Snapshot"}
                  </div>
                  <div className="text-slate-500 mt-0.5">
                    By {v.createdByEmail} · {new Date(v.createdAt).toLocaleString()}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleRollback(v.id)}
                  className="inline-flex items-center gap-1 rounded-full border border-[#0A192F] px-3 py-1.5 font-semibold text-[#0A192F] hover:bg-[#0A192F] hover:text-white shrink-0"
                >
                  <RotateCcw className="h-3 w-3" /> Rollback
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function AdminPagesBuilderPanel({
  pages,
  categories,
  onReload,
  notify,
}: {
  pages: any[];
  categories: any[];
  onReload: () => void;
  notify: (msg: string) => void;
}) {
  const [selectedPageId, setSelectedPageId] = useState<string>(pages[0]?.id || "");
  const [newPageTitle, setNewPageTitle] = useState("");
  const [newPageSlug, setNewPageSlug] = useState("");
  const [newPageCat, setNewPageCat] = useState("");
  const [newCatName, setNewCatName] = useState("");
  const [newCatScope, setNewCatScope] = useState("PAGE");
  const [versionTarget, setVersionTarget] = useState<{ id: string; title: string } | null>(null);

  // Add section state
  const [secType, setSecType] = useState("RICH_TEXT");
  const [secTitle, setSecTitle] = useState("");
  const [secSubtitle, setSecSubtitle] = useState("");
  const [secBodyHtml, setSecBodyHtml] = useState("<p>New modular section content...</p>");
  const [secDataJson, setSecDataJson] = useState("");

  const activePage = pages.find((p) => p.id === selectedPageId) || pages[0];

  const handleCreatePage = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch("/api/admin/content", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entity: "CmsPage",
        payload: {
          title: newPageTitle,
          slug: newPageSlug || newPageTitle,
          categoryId: newCatName ? null : newPageCat || null,
          status: "PUBLISHED",
        },
      }),
    });
    const d = await res.json();
    if (res.ok) {
      setNewPageTitle("");
      setNewPageSlug("");
      setSelectedPageId(d.item.id);
      notify(`Created page /p/${d.item.slug}`);
      onReload();
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch("/api/admin/content", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entity: "Category",
        payload: { name: newCatName, scope: newCatScope },
      }),
    });
    if (res.ok) {
      setNewCatName("");
      notify("Category created.");
      onReload();
    }
  };

  const handleTogglePageStatus = async (page: any) => {
    const nextStatus = page.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED";
    const res = await fetch("/api/admin/content", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entity: "CmsPage",
        payload: { ...page, status: nextStatus, changeNote: `Status changed to ${nextStatus}` },
      }),
    });
    if (res.ok) {
      notify(`Page "${page.title}" is now ${nextStatus}`);
      onReload();
    }
  };

  const handleAddSection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePage) return;
    const res = await fetch("/api/admin/content", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entity: "CmsSection",
        payload: {
          pageId: activePage.id,
          type: secType,
          title: secTitle,
          subtitle: secSubtitle,
          bodyHtml: secBodyHtml,
          dataJson: secDataJson || null,
          sortOrder: (activePage.sections?.length || 0) + 1,
        },
      }),
    });
    if (res.ok) {
      setSecTitle("");
      setSecSubtitle("");
      setSecDataJson("");
      notify("Section added to page.");
      onReload();
    }
  };

  const handleDeleteSection = async (id: string) => {
    await fetch("/api/admin/content", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entity: "CmsSection", action: "DELETE", payload: { id } }),
    });
    notify("Section deleted.");
    onReload();
  };

  return (
    <div className="space-y-6">
      {/* Create New Page + Create Category */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <form
          onSubmit={handleCreatePage}
          className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3"
        >
          <div className="text-xs font-bold uppercase tracking-wider text-[#1D4ED8]">
            Create New Page Without Code
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <input
              required
              type="text"
              value={newPageTitle}
              onChange={(e) => setNewPageTitle(e.target.value)}
              placeholder="Page Title (e.g. Cloud Migration)"
              className="rounded-xl border border-slate-300 px-3 py-2 text-xs"
            />
            <input
              type="text"
              value={newPageSlug}
              onChange={(e) => setNewPageSlug(e.target.value)}
              placeholder="URL slug (optional)"
              className="rounded-xl border border-slate-300 px-3 py-2 text-xs"
            />
          </div>
          <div className="flex gap-2">
            <select
              value={newPageCat}
              onChange={(e) => setNewPageCat(e.target.value)}
              className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-xs"
            >
              <option value="">Select Category (optional)</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.scope})
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="inline-flex items-center gap-1 rounded-full bg-[#0A192F] px-4 py-2 text-xs font-bold text-white"
            >
              <Plus className="h-3.5 w-3.5" /> Create Page
            </button>
          </div>
        </form>

        <form
          onSubmit={handleCreateCategory}
          className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3"
        >
          <div className="text-xs font-bold uppercase tracking-wider text-[#1D4ED8]">
            Create Category Without Code
          </div>
          <div className="flex gap-2">
            <input
              required
              type="text"
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              placeholder="Category Name"
              className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-xs"
            />
            <select
              value={newCatScope}
              onChange={(e) => setNewCatScope(e.target.value)}
              className="rounded-xl border border-slate-300 px-3 py-2 text-xs"
            >
              <option value="PAGE">PAGE</option>
              <option value="INSIGHT">INSIGHT</option>
              <option value="SERVICE">SERVICE</option>
            </select>
            <button
              type="submit"
              className="rounded-full bg-[#0A192F] px-4 py-2 text-xs font-bold text-white"
            >
              Add
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {categories.map((c) => (
              <span
                key={c.id}
                className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-700"
              >
                {c.name} ({c.scope})
              </span>
            ))}
          </div>
        </form>
      </div>

      {/* Pages List & Section Builder */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-4 space-y-2">
          <div className="text-xs font-bold uppercase text-slate-500">All CMS Pages</div>
          {pages.map((p) => (
            <div
              key={p.id}
              onClick={() => setSelectedPageId(p.id)}
              className={`cursor-pointer rounded-xl border p-3.5 transition ${
                activePage?.id === p.id
                  ? "border-[#0A192F] bg-[#0A192F] text-white"
                  : "border-slate-200 bg-white text-[#0A0F1A]"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-sm">{p.title}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    p.status === "PUBLISHED"
                      ? "bg-emerald-500/20 text-emerald-300"
                      : "bg-amber-500/20 text-amber-300"
                  }`}
                >
                  {p.status}
                </span>
              </div>
              <div className="text-[11px] opacity-75 mt-1">/p/{p.slug}</div>
            </div>
          ))}
        </div>

        <div className="lg:col-span-8 space-y-5">
          {activePage && (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
                <div>
                  <h3 className="font-heading text-lg font-bold text-[#0A0F1A]">
                    {activePage.title}
                  </h3>
                  <a
                    href={`/p/${activePage.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-[#1D4ED8] hover:underline"
                  >
                    Preview /p/{activePage.slug} <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setVersionTarget({ id: activePage.id, title: activePage.title })}
                    className="inline-flex items-center gap-1 rounded-full border border-slate-300 px-3 py-1.5 text-xs font-semibold"
                  >
                    <History className="h-3.5 w-3.5" /> Versions
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTogglePageStatus(activePage)}
                    className="rounded-full bg-[#0A192F] px-3.5 py-1.5 text-xs font-bold text-white"
                  >
                    {activePage.status === "PUBLISHED" ? "Move to Draft" : "Publish Page"}
                  </button>
                </div>
              </div>

              {/* Existing Sections */}
              <div className="space-y-2.5">
                <div className="text-xs font-bold uppercase text-slate-500">
                  Modular Sections ({activePage.sections?.length || 0})
                </div>
                {(activePage.sections || []).map((sec: any) => (
                  <div
                    key={sec.id}
                    className="rounded-xl border border-slate-200 bg-[#F8FAFC] p-3.5 flex items-center justify-between gap-3"
                  >
                    <div>
                      <span className="font-mono text-[10px] font-bold bg-[#0A192F] text-white px-2 py-0.5 rounded">
                        {sec.type}
                      </span>
                      <span className="ml-2 font-semibold text-sm text-[#0A0F1A]">
                        {sec.title || "(Untitled Section)"}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteSection(sec.id)}
                      className="text-red-600 hover:bg-red-50 p-1.5 rounded-lg"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Add Section Form */}
              <form onSubmit={handleAddSection} className="border-t pt-4 space-y-3">
                <div className="text-xs font-bold uppercase text-[#1D4ED8]">
                  + Add New Section to &ldquo;{activePage.title}&rdquo;
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <select
                    value={secType}
                    onChange={(e) => setSecType(e.target.value)}
                    className="rounded-xl border border-slate-300 px-3 py-2 text-xs"
                  >
                    <option value="RICH_TEXT">Rich Text Block</option>
                    <option value="CARDS_GRID">Cards Grid (JSON)</option>
                    <option value="STATS_GRID">Stats Grid (JSON)</option>
                    <option value="CTA_BAND">CTA Band</option>
                  </select>
                  <input
                    type="text"
                    value={secTitle}
                    onChange={(e) => setSecTitle(e.target.value)}
                    placeholder="Section Heading"
                    className="rounded-xl border border-slate-300 px-3 py-2 text-xs"
                  />
                  <input
                    type="text"
                    value={secSubtitle}
                    onChange={(e) => setSecSubtitle(e.target.value)}
                    placeholder="Subtitle (optional)"
                    className="rounded-xl border border-slate-300 px-3 py-2 text-xs"
                  />
                </div>
                {secType === "RICH_TEXT" ? (
                  <RichTextEditor value={secBodyHtml} onChange={setSecBodyHtml} minHeight="150px" />
                ) : (
                  <textarea
                    rows={3}
                    value={secDataJson}
                    onChange={(e) => setSecDataJson(e.target.value)}
                    placeholder={
                      secType === "STATS_GRID"
                        ? '[{"value":"99.9%","label":"Uptime"}]'
                        : secType === "CARDS_GRID"
                        ? '[{"title":"Card 1","desc":"Description"}]'
                        : '{"ctaLabel":"Contact Us","ctaHref":"/contact"}'
                    }
                    className="w-full rounded-xl border border-slate-300 p-3 font-mono text-xs"
                  />
                )}
                <button
                  type="submit"
                  className="rounded-full bg-[#0A192F] px-5 py-2 text-xs font-bold text-white"
                >
                  Save Section
                </button>
              </form>
            </div>
          )}
        </div>
      </div>

      {versionTarget && (
        <VersionHistoryModal
          entityType="CmsPage"
          entityId={versionTarget.id}
          title={versionTarget.title}
          onClose={() => setVersionTarget(null)}
          onRolledBack={onReload}
        />
      )}
    </div>
  );
}

export function AdminCatalogEditorPanel({
  services,
  industries,
  caseStudies,
  insights,
  saasProducts,
  onReload,
  notify,
}: {
  services: any[];
  industries: any[];
  caseStudies: any[];
  insights: any[];
  saasProducts: any[];
  onReload: () => void;
  notify: (msg: string) => void;
}) {
  const [subTab, setSubTab] = useState<"SAAS" | "SERVICES" | "INDUSTRIES" | "PORTFOLIO" | "INSIGHTS">(
    "SAAS"
  );
  const [editing, setEditing] = useState<any | null>(null);
  const [versionTarget, setVersionTarget] = useState<{
    type: string;
    id: string;
    title: string;
  } | null>(null);

  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    const res = await fetch("/api/admin/content", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entity: editing._entity, payload: editing }),
    });
    if (res.ok) {
      notify(`Saved ${editing._entity} "${editing.name || editing.title}" (version snapshot recorded)`);
      setEditing(null);
      onReload();
    } else {
      alert("Save failed.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {[
          { id: "SAAS", label: `SaaS Products (${saasProducts.length})` },
          { id: "SERVICES", label: `Services (${services.length})` },
          { id: "INDUSTRIES", label: `Industries (${industries.length})` },
          { id: "PORTFOLIO", label: `Portfolio (${caseStudies.length})` },
          { id: "INSIGHTS", label: `Insights (${insights.length})` },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              setSubTab(t.id as any);
              setEditing(null);
            }}
            className={`rounded-full px-4 py-1.5 text-xs font-semibold ${
              subTab === t.id
                ? "bg-[#0A192F] text-white"
                : "bg-white border border-slate-200 text-slate-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {editing ? (
        <form onSubmit={saveEdit} className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
          <div className="flex items-center justify-between border-b pb-3">
            <h3 className="font-heading text-lg font-bold">
              Editing: {editing.name || editing.title || "New Article"}
            </h3>
            <div className="flex items-center gap-2">
              <select
                value={editing.status || "PUBLISHED"}
                onChange={(e) => setEditing({ ...editing, status: e.target.value })}
                className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-semibold"
              >
                <option value="PUBLISHED">PUBLISHED</option>
                <option value="DRAFT">DRAFT</option>
              </select>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="text-xs text-slate-500 px-2"
              >
                Cancel
              </button>
            </div>
          </div>

          {editing._entity === "SaasProduct" && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">Product Name</label>
                  <input
                    value={editing.name}
                    onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Tagline</label>
                  <input
                    value={editing.tagline}
                    onChange={(e) => setEditing({ ...editing, tagline: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Codos Console Path</label>
                  <input
                    value={editing.consolePath}
                    onChange={(e) => setEditing({ ...editing, consolePath: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">
                    External Codos Console Redirect URL (optional)
                  </label>
                  <input
                    value={editing.externalConsoleUrl || ""}
                    onChange={(e) => setEditing({ ...editing, externalConsoleUrl: e.target.value })}
                    placeholder="https://console.viacodos.com/..."
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Summary</label>
                <textarea
                  rows={2}
                  value={editing.summary}
                  onChange={(e) => setEditing({ ...editing, summary: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 p-3 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Rich Description</label>
                <RichTextEditor
                  value={editing.descriptionHtml}
                  onChange={(v) => setEditing({ ...editing, descriptionHtml: v })}
                />
              </div>
            </>
          )}

          {editing._entity === "Service" && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">Service Name</label>
                  <input
                    value={editing.name}
                    onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Tagline</label>
                  <input
                    value={editing.tagline}
                    onChange={(e) => setEditing({ ...editing, tagline: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">One-Liner</label>
                <textarea
                  rows={2}
                  value={editing.oneliner}
                  onChange={(e) => setEditing({ ...editing, oneliner: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 p-3 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">Stat Value</label>
                  <input
                    value={editing.statValue}
                    onChange={(e) => setEditing({ ...editing, statValue: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Stat Label</label>
                  <input
                    value={editing.statLabel}
                    onChange={(e) => setEditing({ ...editing, statLabel: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>
            </>
          )}

          {editing._entity === "Industry" && (
            <>
              <div>
                <label className="block text-xs font-semibold mb-1">Industry Name</label>
                <input
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Introduction</label>
                <textarea
                  rows={3}
                  value={editing.intro}
                  onChange={(e) => setEditing({ ...editing, intro: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 p-3 text-sm"
                />
              </div>
            </>
          )}

          {editing._entity === "CaseStudy" && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">Project Name</label>
                  <input
                    value={editing.name}
                    onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Headline Metric</label>
                  <input
                    value={editing.headline}
                    onChange={(e) => setEditing({ ...editing, headline: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Solution Narrative</label>
                <textarea
                  rows={3}
                  value={editing.solution}
                  onChange={(e) => setEditing({ ...editing, solution: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 p-3 text-sm"
                />
              </div>
            </>
          )}

          {editing._entity === "InsightArticle" && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold mb-1">Article Title</label>
                  <input
                    required
                    value={editing.title}
                    onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Category</label>
                  <input
                    value={editing.category}
                    onChange={(e) => setEditing({ ...editing, category: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Excerpt</label>
                <textarea
                  rows={2}
                  value={editing.excerpt}
                  onChange={(e) => setEditing({ ...editing, excerpt: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 p-3 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Article Body (Rich Text)</label>
                <RichTextEditor
                  value={editing.bodyHtml}
                  onChange={(v) => setEditing({ ...editing, bodyHtml: v })}
                />
              </div>
            </>
          )}

          <button
            type="submit"
            className="rounded-full bg-[#0A192F] px-6 py-2.5 text-xs font-bold text-white hover:bg-[#1E3A8A]"
          >
            Save &amp; Snapshot Version
          </button>
        </form>
      ) : (
        <div className="space-y-3">
          {subTab === "INSIGHTS" && (
            <button
              type="button"
              onClick={() =>
                setEditing({
                  _entity: "InsightArticle",
                  title: "",
                  category: "Technology",
                  dateLabel: "2026",
                  readTime: "5 min read",
                  excerpt: "",
                  bodyHtml: "<p></p>",
                  status: "DRAFT",
                })
              }
              className="inline-flex items-center gap-1.5 rounded-full bg-[#0A192F] px-4 py-2 text-xs font-bold text-white"
            >
              <Plus className="h-3.5 w-3.5" /> New Insight Article
            </button>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(subTab === "SAAS"
              ? saasProducts.map((x) => ({ ...x, _entity: "SaasProduct" }))
              : subTab === "SERVICES"
              ? services.map((x) => ({
                  ...x,
                  _entity: "Service",
                  body: JSON.parse(x.bodyJson || "[]"),
                  included: JSON.parse(x.includedJson || "[]"),
                }))
              : subTab === "INDUSTRIES"
              ? industries.map((x) => ({
                  ...x,
                  _entity: "Industry",
                  challenges: JSON.parse(x.challengesJson || "[]"),
                  solutions: JSON.parse(x.solutionsJson || "[]"),
                }))
              : subTab === "PORTFOLIO"
              ? caseStudies.map((x) => ({ ...x, _entity: "CaseStudy" }))
              : insights.map((x) => ({ ...x, _entity: "InsightArticle" }))
            ).map((item) => (
              <div
                key={item.id}
                className="rounded-xl border border-slate-200 bg-white p-4 flex items-center justify-between gap-3"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-[#0A0F1A]">
                      {item.name || item.title}
                    </span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold">
                      {item.status}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">/{item.slug}</div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setVersionTarget({
                        type: item._entity,
                        id: item.id,
                        title: item.name || item.title,
                      })
                    }
                    className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"
                    title="Version History & Rollback"
                  >
                    <History className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditing(item)}
                    className="rounded-full bg-[#0A192F] px-3.5 py-1.5 text-xs font-semibold text-white"
                  >
                    Edit
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {versionTarget && (
        <VersionHistoryModal
          entityType={versionTarget.type}
          entityId={versionTarget.id}
          title={versionTarget.title}
          onClose={() => setVersionTarget(null)}
          onRolledBack={onReload}
        />
      )}
    </div>
  );
}

export function AdminMenusMediaPanel({
  menus,
  settings,
  media,
  onReload,
  notify,
}: {
  menus: any[];
  settings: any[];
  media: any[];
  onReload: () => void;
  notify: (msg: string) => void;
}) {
  const [mLoc, setMLoc] = useState("HEADER");
  const [mLabel, setMLabel] = useState("");
  const [mHref, setMHref] = useState("");
  const [mOrder, setMOrder] = useState(10);

  const heroSetting = settings.find((s) => s.key === "hero");
  const parsedHero = heroSetting ? JSON.parse(heroSetting.valueJson) : {};
  const [heroHeadline, setHeroHeadline] = useState(parsedHero.headline || "");
  const [heroSubheadline, setHeroSubheadline] = useState(parsedHero.subheadline || "");

  const brandSetting = settings.find((s) => s.key === "brand");
  const parsedBrand = brandSetting ? JSON.parse(brandSetting.valueJson) : {};
  const [consoleUrl, setConsoleUrl] = useState(parsedBrand.codosConsoleUrl || "/codos-console");

  const [uploading, setUploading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleAddMenu = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch("/api/admin/content", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entity: "MenuItem",
        payload: { location: mLoc, label: mLabel, href: mHref, sortOrder: mOrder, isVisible: true },
      }),
    });
    if (res.ok) {
      setMLabel("");
      setMHref("");
      notify("Navigation item added.");
      onReload();
    }
  };

  const handleDeleteMenu = async (id: string, label: string) => {
    await fetch("/api/admin/content", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entity: "MenuItem", action: "DELETE", payload: { id, label } }),
    });
    notify("Menu item deleted.");
    onReload();
  };

  const handleSaveHeroAndBrand = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch("/api/admin/content", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entity: "SiteSetting",
        payload: {
          key: "hero",
          value: { ...parsedHero, headline: heroHeadline, subheadline: heroSubheadline },
        },
      }),
    });
    await fetch("/api/admin/content", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entity: "SiteSetting",
        payload: {
          key: "brand",
          value: { ...parsedBrand, codosConsoleUrl: consoleUrl },
        },
      }),
    });
    notify("Hero & Codos Console settings saved.");
    onReload();
  };

  const handleUploadMedia = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
    setUploading(false);
    if (res.ok) {
      notify("Image uploaded to Media Library.");
      onReload();
    }
  };

  return (
    <div className="space-y-8">
      {/* Hero & Console Settings */}
      <form
        onSubmit={handleSaveHeroAndBrand}
        className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4"
      >
        <h3 className="font-heading text-base font-bold text-[#0A0F1A]">
          Homepage 3D Hero &amp; Codos Console Connection Settings
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold mb-1">Hero Headline</label>
            <input
              value={heroHeadline}
              onChange={(e) => setHeroHeadline(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">
              Connected Codos Console URL
            </label>
            <input
              value={consoleUrl}
              onChange={(e) => setConsoleUrl(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1">Hero Subheadline</label>
          <textarea
            rows={2}
            value={heroSubheadline}
            onChange={(e) => setHeroSubheadline(e.target.value)}
            className="w-full rounded-xl border border-slate-300 p-3 text-sm"
          />
        </div>
        <button
          type="submit"
          className="rounded-full bg-[#0A192F] px-5 py-2 text-xs font-bold text-white"
        >
          Save Settings
        </button>
      </form>

      {/* Menus & Footer Editor */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
        <h3 className="font-heading text-base font-bold text-[#0A0F1A]">
          Header &amp; Footer Menus Editor
        </h3>
        <form onSubmit={handleAddMenu} className="grid grid-cols-1 sm:grid-cols-5 gap-2.5">
          <select
            value={mLoc}
            onChange={(e) => setMLoc(e.target.value)}
            className="rounded-xl border border-slate-300 px-3 py-2 text-xs"
          >
            <option value="HEADER">HEADER</option>
            <option value="FOOTER_COMPANY">FOOTER_COMPANY</option>
            <option value="FOOTER_RESOURCES">FOOTER_RESOURCES</option>
            <option value="FOOTER_LEGAL">FOOTER_LEGAL</option>
          </select>
          <input
            required
            value={mLabel}
            onChange={(e) => setMLabel(e.target.value)}
            placeholder="Link Label"
            className="rounded-xl border border-slate-300 px-3 py-2 text-xs"
          />
          <input
            required
            value={mHref}
            onChange={(e) => setMHref(e.target.value)}
            placeholder="/path or https://..."
            className="sm:col-span-2 rounded-xl border border-slate-300 px-3 py-2 text-xs"
          />
          <button
            type="submit"
            className="rounded-full bg-[#0A192F] px-4 py-2 text-xs font-bold text-white"
          >
            + Add Link
          </button>
        </form>

        <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
          {menus.map((m) => (
            <div key={m.id} className="py-2.5 flex items-center justify-between text-xs">
              <div>
                <span className="font-mono text-[10px] bg-slate-100 px-2 py-0.5 rounded mr-2">
                  {m.location}
                </span>
                <strong>{m.label}</strong>{" "}
                <span className="text-slate-500">→ {m.href}</span>
              </div>
              <button
                type="button"
                onClick={() => handleDeleteMenu(m.id, m.label)}
                className="text-red-600 hover:underline"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Image / Media Library */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-heading text-base font-bold text-[#0A0F1A]">
            Image &amp; Media Library
          </h3>
          <label className="inline-flex items-center gap-2 rounded-full bg-[#0A192F] px-4 py-2 text-xs font-bold text-white cursor-pointer">
            <Upload className="h-3.5 w-3.5" />
            {uploading ? "Uploading..." : "Upload Image"}
            <input type="file" accept="image/*" onChange={handleUploadMedia} className="hidden" />
          </label>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {media.map((asset) => (
            <div key={asset.id} className="rounded-xl border border-slate-200 overflow-hidden bg-[#F8FAFC]">
              <img src={asset.url} alt={asset.altText || ""} className="h-28 w-full object-cover" />
              <div className="p-2.5 text-[11px]">
                <div className="font-semibold truncate">{asset.originalName}</div>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(asset.url);
                    setCopiedId(asset.id);
                    setTimeout(() => setCopiedId(null), 1500);
                  }}
                  className="mt-1 inline-flex items-center gap-1 text-[#1D4ED8] font-semibold"
                >
                  {copiedId === asset.id ? (
                    <>
                      <Check className="h-3 w-3" /> Copied URL
                    </>
                  ) : (
                    "Copy URL"
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

