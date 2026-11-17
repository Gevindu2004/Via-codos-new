"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Plus, FileSignature, History, ExternalLink, Copy } from "lucide-react";
import { RichTextEditor } from "@/components/RichTextEditor";
import { VersionHistoryModal } from "./AdminCmsPanels";

export function AdminLegalPanel({
  types,
  documents,
  signatureRequests,
  onReload,
  notify,
}: {
  types: any[];
  documents: any[];
  signatureRequests: any[];
  onReload: () => void;
  notify: (msg: string) => void;
}) {
  // New document type form
  const [newTypeName, setNewTypeName] = useState("");
  const [newTypePublic, setNewTypePublic] = useState(true);
  const [newTypeTemplate, setNewTypeTemplate] = useState(false);

  // Edit / Create legal document
  const [editingDoc, setEditingDoc] = useState<any | null>(null);
  const [versionTarget, setVersionTarget] = useState<{ id: string; title: string } | null>(null);

  // E-Sign Link Generator
  const [signDocId, setSignDocId] = useState<string>(
    documents.find((d) => d.isTemplate)?.id || documents[0]?.id || ""
  );
  const [signClientName, setSignClientName] = useState("");
  const [signClientEmail, setSignClientEmail] = useState("");
  const [signClientCompany, setSignClientCompany] = useState("");
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);

  const handleCreateType = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch("/api/admin/legal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "CREATE_TYPE",
        name: newTypeName,
        isPublicPolicy: newTypePublic,
        isPrivateTemplate: newTypeTemplate,
      }),
    });
    if (res.ok) {
      setNewTypeName("");
      notify("Created new legal document type.");
      onReload();
    }
  };

  const handleSaveDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch("/api/admin/legal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "SAVE_DOC",
        ...editingDoc,
      }),
    });
    if (res.ok) {
      notify(`Saved legal document "${editingDoc.title}" v${editingDoc.version}`);
      setEditingDoc(null);
      onReload();
    }
  };

  const handleGenerateSignLink = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch("/api/admin/legal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "GENERATE_SIGN_LINK",
        documentId: signDocId,
        clientName: signClientName,
        clientEmail: signClientEmail,
        clientCompany: signClientCompany,
      }),
    });
    const d = await res.json();
    if (res.ok) {
      setGeneratedUrl(d.signUrl);
      setSignClientName("");
      setSignClientEmail("");
      setSignClientCompany("");
      notify("Generated unique e-sign link and logged email notification.");
      onReload();
    }
  };

  return (
    <div className="space-y-8">
      {/* 1. Unlimited Legal Document Types + Generate Client Signing Link */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <form
          onSubmit={handleCreateType}
          className="rounded-2xl border border-slate-200 bg-white p-6 space-y-3"
        >
          <div className="text-xs font-bold uppercase tracking-wider text-[#1D4ED8]">
            Add Unlimited Legal Document Type
          </div>
          <input
            required
            value={newTypeName}
            onChange={(e) => setNewTypeName(e.target.value)}
            placeholder="e.g. IP Assignment Agreement, Vendor DPA"
            className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm"
          />
          <div className="flex flex-wrap gap-4 text-xs">
            <label className="flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={newTypePublic}
                onChange={(e) => setNewTypePublic(e.target.checked)}
              />
              Public Policy
            </label>
            <label className="flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={newTypeTemplate}
                onChange={(e) => setNewTypeTemplate(e.target.checked)}
              />
              Private Agreement Template
            </label>
          </div>
          <button
            type="submit"
            className="inline-flex items-center gap-1 rounded-full bg-[#0A192F] px-4 py-2 text-xs font-bold text-white"
          >
            <Plus className="h-3.5 w-3.5" /> Add Document Type
          </button>
        </form>

        {/* Generate E-Sign Link */}
        <form
          onSubmit={handleGenerateSignLink}
          className="rounded-2xl border border-[#0A192F]/20 bg-[#F8FAFC] p-6 space-y-3"
        >
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#0A192F]">
            <FileSignature className="h-4 w-4 text-[#1D4ED8]" />
            Generate Client E-Sign Agreement Link
          </div>
          <select
            value={signDocId}
            onChange={(e) => setSignDocId(e.target.value)}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
          >
            {documents.map((d) => (
              <option key={d.id} value={d.id}>
                [{d.isTemplate ? "TEMPLATE" : "PUBLIC"}] {d.title} (v{d.version})
              </option>
            ))}
          </select>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <input
              required
              value={signClientName}
              onChange={(e) => setSignClientName(e.target.value)}
              placeholder="Client Name *"
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
            />
            <input
              required
              type="email"
              value={signClientEmail}
              onChange={(e) => setSignClientEmail(e.target.value)}
              placeholder="Client Email *"
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
            />
            <input
              value={signClientCompany}
              onChange={(e) => setSignClientCompany(e.target.value)}
              placeholder="Company"
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
            />
          </div>
          <button
            type="submit"
            className="rounded-full bg-[#0A192F] px-5 py-2 text-xs font-bold text-white hover:bg-[#1E3A8A]"
          >
            Generate &amp; Send Signing Link
          </button>
          {generatedUrl && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs flex items-center justify-between gap-2">
              <Link href={generatedUrl} target="_blank" className="font-mono font-bold text-emerald-800 underline truncate">
                {generatedUrl}
              </Link>
              <button
                type="button"
                onClick={() => navigator.clipboard?.writeText(window.location.origin + generatedUrl)}
                className="inline-flex items-center gap-1 text-emerald-800 font-semibold shrink-0"
              >
                <Copy className="h-3.5 w-3.5" /> Copy
              </button>
            </div>
          )}
        </form>
      </div>

      {/* 2. Legal Document Editor or List */}
      {editingDoc ? (
        <form
          onSubmit={handleSaveDoc}
          className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4"
        >
          <div className="flex items-center justify-between border-b pb-3">
            <h3 className="font-heading text-lg font-bold">
              {editingDoc.id ? `Edit: ${editingDoc.title}` : "Create New Legal Document"}
            </h3>
            <button
              type="button"
              onClick={() => setEditingDoc(null)}
              className="text-xs text-slate-500"
            >
              Cancel
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold mb-1">Document Title *</label>
              <input
                required
                value={editingDoc.title}
                onChange={(e) => setEditingDoc({ ...editingDoc, title: e.target.value })}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Document Type *</label>
              <select
                value={editingDoc.typeId}
                onChange={(e) => setEditingDoc({ ...editingDoc, typeId: e.target.value })}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              >
                {types.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Version &amp; Status</label>
              <div className="flex gap-1.5">
                <input
                  value={editingDoc.version}
                  onChange={(e) => setEditingDoc({ ...editingDoc, version: e.target.value })}
                  placeholder="1.0"
                  className="w-20 rounded-xl border border-slate-300 px-2.5 py-2 text-sm"
                />
                <select
                  value={editingDoc.status}
                  onChange={(e) => setEditingDoc({ ...editingDoc, status: e.target.value })}
                  className="flex-1 rounded-xl border border-slate-300 px-2 py-2 text-xs font-semibold"
                >
                  <option value="PUBLISHED">PUBLISHED</option>
                  <option value="DRAFT">DRAFT</option>
                </select>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
            <div>
              <label className="block text-xs font-semibold mb-1">Effective Date</label>
              <input
                type="date"
                value={
                  editingDoc.effectiveDate
                    ? new Date(editingDoc.effectiveDate).toISOString().slice(0, 10)
                    : new Date().toISOString().slice(0, 10)
                }
                onChange={(e) => setEditingDoc({ ...editingDoc, effectiveDate: e.target.value })}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <label className="flex items-center gap-2 text-xs font-semibold pt-4">
              <input
                type="checkbox"
                checked={Boolean(editingDoc.isPublic)}
                onChange={(e) => setEditingDoc({ ...editingDoc, isPublic: e.target.checked })}
              />
              Publish Publicly at /legal/[slug]
            </label>
            <label className="flex items-center gap-2 text-xs font-semibold pt-4">
              <input
                type="checkbox"
                checked={Boolean(editingDoc.isTemplate)}
                onChange={(e) => setEditingDoc({ ...editingDoc, isTemplate: e.target.checked })}
              />
              Private E-Sign Template Library
            </label>
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1">Document Content</label>
            <RichTextEditor
              value={editingDoc.contentHtml}
              onChange={(v) => setEditingDoc({ ...editingDoc, contentHtml: v })}
            />
          </div>

          <button
            type="submit"
            className="rounded-full bg-[#0A192F] px-6 py-2.5 text-xs font-bold text-white"
          >
            Save Legal Record &amp; Version
          </button>
        </form>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-heading text-base font-bold text-[#0A0F1A]">
              Public Policies &amp; Private Template Library ({documents.length})
            </h3>
            <button
              type="button"
              onClick={() =>
                setEditingDoc({
                  typeId: types[0]?.id || "",
                  title: "",
                  version: "1.0",
                  effectiveDate: new Date().toISOString().slice(0, 10),
                  contentHtml: "<h2>Agreement Terms</h2><p></p>",
                  status: "PUBLISHED",
                  isPublic: false,
                  isTemplate: true,
                })
              }
              className="inline-flex items-center gap-1 rounded-full bg-[#0A192F] px-4 py-2 text-xs font-bold text-white"
            >
              <Plus className="h-3.5 w-3.5" /> New Legal Document / Template
            </button>
          </div>

          <div className="divide-y divide-slate-100">
            {documents.map((d) => (
              <div key={d.id} className="py-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-[#0A0F1A]">{d.title}</span>
                    <span className="font-mono text-[11px] text-slate-500">v{d.version}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        d.isTemplate
                          ? "bg-indigo-100 text-indigo-800"
                          : "bg-emerald-100 text-emerald-800"
                      }`}
                    >
                      {d.isTemplate ? "PRIVATE TEMPLATE" : "PUBLIC POLICY"}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    Type: {d.type?.name} · Effective {new Date(d.effectiveDate).toLocaleDateString()} ·{" "}
                    {d.status}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setVersionTarget({ id: d.id, title: d.title })}
                    className="rounded-lg border border-slate-200 p-2 text-slate-600"
                    title="Version History & Rollback"
                  >
                    <History className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingDoc(d)}
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

      {/* 3. Active & Signed E-Sign Requests */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-3">
        <h3 className="font-heading text-base font-bold text-[#0A0F1A]">
          E-Signature Dispatch &amp; Signed PDFs ({signatureRequests.length})
        </h3>
        <div className="divide-y divide-slate-100">
          {signatureRequests.map((s) => (
            <div key={s.id} className="py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div>
                <div className="font-bold text-[#0A0F1A]">
                  {s.documentTitle} — {s.clientName} ({s.clientEmail})
                </div>
                <div className="text-slate-500">
                  Status: <strong>{s.status}</strong>{" "}
                  {s.signedAt && `· Signed ${new Date(s.signedAt).toLocaleString()}`}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  href={`/sign/${s.token}`}
                  target="_blank"
                  className="inline-flex items-center gap-1 rounded-full border border-slate-300 px-3 py-1.5 font-semibold"
                >
                  Open Link <ExternalLink className="h-3 w-3" />
                </Link>
                {s.signedPdfPath && (
                  <a
                    href={`/api/sign/${s.token}/pdf`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-full bg-emerald-700 px-3 py-1.5 font-bold text-white"
                  >
                    Signed PDF
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {versionTarget && (
        <VersionHistoryModal
          entityType="LegalDocument"
          entityId={versionTarget.id}
          title={versionTarget.title}
          onClose={() => setVersionTarget(null)}
          onRolledBack={onReload}
        />
      )}
    </div>
  );
}

