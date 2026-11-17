"use client";

import React, { useState } from "react";
import {
  CheckCircle2,
  XCircle,
  UserCheck,
  Sparkles,
  Download,
  Plus,
  Users,
} from "lucide-react";

export function AdminTalentPipelinePanel({
  clients,
  requests,
  inquiries,
  talentData,
  onReload,
  notify,
}: {
  clients: any[];
  requests: any[];
  inquiries: any[];
  talentData: { profiles: any[]; metrics: any };
  onReload: () => void;
  notify: (msg: string) => void;
}) {
  const verifyClient = async (clientId: string, status: "VERIFIED" | "REJECTED") => {
    const res = await fetch("/api/admin/pipeline", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "VERIFY_CLIENT",
        clientId,
        status,
        notes: status === "VERIFIED" ? "Company verified by Admin." : "Verification declined.",
      }),
    });
    if (res.ok) {
      notify(`Client marked ${status}`);
      onReload();
    }
  };

  const approveRequest = async (requestId: string) => {
    const res = await fetch("/api/admin/pipeline", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "APPROVE_PROFILE_REQUEST",
        requestId,
      }),
    });
    if (res.ok) {
      notify("Approved full profile dossier release & enabled AI interview scheduling.");
      onReload();
    }
  };

  const markPlaced = async (requestId: string) => {
    const res = await fetch("/api/admin/pipeline", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "MARK_PLACED", requestId }),
    });
    if (res.ok) {
      notify("Engineer marked PLACED.");
      onReload();
    }
  };

  const updateInquiry = async (inquiryId: string, status: string) => {
    const res = await fetch("/api/admin/pipeline", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "UPDATE_INQUIRY_STATUS", inquiryId, status }),
    });
    if (res.ok) {
      notify(`Inquiry status updated to ${status}`);
      onReload();
    }
  };

  return (
    <div className="space-y-8">
      {/* Sample vs Real Ratio Tracker */}
      <div className="rounded-2xl border border-[#0A192F]/20 bg-[#0A192F] text-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-sky-300">
              Talent Bench Composition (Sample vs Real Ratio)
            </div>
            <div className="font-heading text-2xl font-extrabold mt-1">
              {talentData.metrics?.realCount || 0} Real Profiles /{" "}
              {talentData.metrics?.sampleCount || 0} Sample Profiles (
              {talentData.metrics?.realRatioPct || 0}% Real)
            </div>
          </div>
          <div className="text-xs text-slate-300">
            Total Published Bench: <strong>{talentData.metrics?.totalPublished || 0}</strong>
          </div>
        </div>
        <div className="mt-4 h-3 w-full rounded-full bg-white/15 overflow-hidden">
          <div
            className="h-full bg-emerald-400 transition-all"
            style={{ width: `${talentData.metrics?.realRatioPct || 0}%` }}
          />
        </div>
      </div>

      {/* 1. Client Verification Queue */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
        <h3 className="font-heading text-base font-bold text-[#0A0F1A]">
          Client Company Verification ({clients.length})
        </h3>
        <div className="divide-y divide-slate-100">
          {clients.map((c) => (
            <div key={c.id} className="py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div>
                <div className="font-bold text-sm text-[#0A0F1A]">
                  {c.companyName} — {c.name} ({c.email})
                </div>
                <div className="text-slate-500">
                  {c.companyCountry || "Global"} · {c.companyWebsite || "No website"} · Status:{" "}
                  <strong>{c.verificationStatus}</strong>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => verifyClient(c.id, "VERIFIED")}
                  className="inline-flex items-center gap-1 rounded-full bg-emerald-700 px-3 py-1.5 font-bold text-white"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" /> Verify
                </button>
                <button
                  type="button"
                  onClick={() => verifyClient(c.id, "REJECTED")}
                  className="inline-flex items-center gap-1 rounded-full border border-red-300 px-3 py-1.5 font-semibold text-red-700"
                >
                  <XCircle className="h-3.5 w-3.5" /> Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 2. Client Profile Requests & Hiring Pipeline */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
        <h3 className="font-heading text-base font-bold text-[#0A0F1A]">
          Profile Requests &amp; 6-Stage Pipeline ({requests.length})
        </h3>
        <div className="divide-y divide-slate-100">
          {requests.map((r) => (
            <div key={r.id} className="py-4 flex flex-wrap items-center justify-between gap-4 text-xs">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold bg-[#0A192F] text-white px-2 py-0.5 rounded">
                    {r.talent.profileCode}
                  </span>
                  <strong className="text-sm text-[#0A0F1A]">{r.client.companyName}</strong>
                  <span className="rounded-full bg-sky-100 text-sky-800 px-2.5 py-0.5 font-bold">
                    {r.stage}
                  </span>
                  {r.talent.placementStatus === "PLACED" && (
                    <span className="rounded-full bg-emerald-100 text-emerald-800 px-2.5 py-0.5 font-bold">
                      PLACED
                    </span>
                  )}
                </div>
                <div className="text-slate-500 mt-1">
                  Role: {r.talent.roleTitle} · Interviews: {r.interviews?.length || 0} · Meetings:{" "}
                  {r.meetings?.length || 0}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {r.stage === "REQUESTED" && (
                  <button
                    type="button"
                    onClick={() => approveRequest(r.id)}
                    className="inline-flex items-center gap-1 rounded-full bg-[#0A192F] px-4 py-1.5 font-bold text-white"
                  >
                    <UserCheck className="h-3.5 w-3.5" /> Approve Profile Release
                  </button>
                )}
                {r.stage !== "HIRED" && r.stage !== "REQUESTED" && (
                  <button
                    type="button"
                    onClick={() => markPlaced(r.id)}
                    className="rounded-full border border-emerald-700 px-3.5 py-1.5 font-bold text-emerald-800 hover:bg-emerald-50"
                  >
                    Mark Placed
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 3. Structured Staff Augmentation Inquiries */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
        <h3 className="font-heading text-base font-bold text-[#0A0F1A]">
          Structured Staff Augmentation Inquiries ({inquiries.length})
        </h3>
        {inquiries.length === 0 ? (
          <p className="text-xs text-slate-500">No inquiries submitted yet.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {inquiries.map((inq) => (
              <div key={inq.id} className="py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div>
                  <span className="font-mono font-bold text-[#1D4ED8] mr-2">
                    {inq.referenceCode}
                  </span>
                  <strong>{inq.name}</strong> ({inq.email}) — {inq.company || "Individual"}
                  <div className="text-slate-500 mt-0.5">
                    {inq.domain} · {inq.roleNeeded || inq.serviceLine} · Headcount: {inq.headcount}
                  </div>
                </div>
                <select
                  value={inq.status}
                  onChange={(e) => updateInquiry(inq.id, e.target.value)}
                  className="rounded-lg border border-slate-300 px-2.5 py-1 font-semibold"
                >
                  <option value="NEW">NEW</option>
                  <option value="CONTACTED">CONTACTED</option>
                  <option value="QUALIFIED">QUALIFIED</option>
                  <option value="CLOSED">CLOSED</option>
                </select>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function AdminCareersScreeningPanel({
  careersData,
  talentMetrics,
  onReload,
  notify,
}: {
  careersData: { domains: any[]; postings: any[]; applications: any[]; sampleProfiles: any[] };
  talentMetrics: any;
  onReload: () => void;
  notify: (msg: string) => void;
}) {
  const [newDomainName, setNewDomainName] = useState("");
  const [newDomainCat, setNewDomainCat] = useState("IT");

  const [jobTitle, setJobTitle] = useState("");
  const [jobDomainSlug, setJobDomainSlug] = useState(careersData.domains[0]?.slug || "software-engineering");
  const [jobExp, setJobExp] = useState("3+ years experience");
  const [jobSkills, setJobSkills] = useState("");

  // Conversion modal
  const [convertApp, setConvertApp] = useState<any | null>(null);
  const [convertRoleTitle, setConvertRoleTitle] = useState("");
  const [convertRate, setConvertRate] = useState("4800");
  const [replaceSampleId, setReplaceSampleId] = useState("");

  const handleAddDomain = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch("/api/admin/careers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "CREATE_DOMAIN", name: newDomainName, category: newDomainCat }),
    });
    if (res.ok) {
      setNewDomainName("");
      notify("Job & Talent domain added.");
      onReload();
    }
  };

  const handleAddJob = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch("/api/admin/careers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "CREATE_JOB",
        title: jobTitle,
        domainSlug: jobDomainSlug,
        experienceRequired: jobExp,
        skills: jobSkills.split(",").map((s) => s.trim()).filter(Boolean),
        responsibilities: ["Collaborate directly inside client engineering pods"],
      }),
    });
    if (res.ok) {
      setJobTitle("");
      setJobSkills("");
      notify("Open role published to Careers board.");
      onReload();
    }
  };

  const updateScreeningStatus = async (applicationId: string, screeningStatus: string) => {
    await fetch("/api/admin/careers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "UPDATE_SCREENING", applicationId, screeningStatus }),
    });
    notify(`Applicant moved to ${screeningStatus}`);
    onReload();
  };

  const handleConvertSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!convertApp) return;
    const res = await fetch("/api/admin/careers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "CONVERT_TO_PROFILE",
        applicationId: convertApp.id,
        roleTitle: convertRoleTitle,
        monthlyRateUsd: Number(convertRate || 4500),
        replaceSampleProfileId: replaceSampleId || null,
      }),
    });
    const d = await res.json();
    if (res.ok) {
      setConvertApp(null);
      notify(`Converted applicant to live REAL anonymized profile ${d.profile.profileCode}!`);
      onReload();
    } else {
      alert(d.error || "Conversion failed.");
    }
  };

  return (
    <div className="space-y-8">
      {/* Sample vs Real Bench Tracker */}
      <div className="rounded-2xl border border-[#0A192F]/20 bg-[#0A192F] text-white p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Users className="h-6 w-6 text-sky-300" />
          <div>
            <div className="text-xs uppercase tracking-wider text-sky-300 font-bold">
              Real-Candidate Conversion Ratio
            </div>
            <div className="font-heading text-lg font-bold">
              {talentMetrics?.realCount || 0} Real · {talentMetrics?.sampleCount || 0} Sample (
              {talentMetrics?.realRatioPct || 0}% Live Real Talent)
            </div>
          </div>
        </div>
        <span className="text-xs text-slate-300">
          Convert approved consented applicants below to replace Sample profiles.
        </span>
      </div>

      {/* Add Job Domain + Publish Open Role */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <form onSubmit={handleAddDomain} className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
          <div className="text-xs font-bold uppercase text-[#1D4ED8]">Add Job Domain</div>
          <div className="flex gap-2">
            <input
              required
              value={newDomainName}
              onChange={(e) => setNewDomainName(e.target.value)}
              placeholder="Domain Name"
              className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-xs"
            />
            <select
              value={newDomainCat}
              onChange={(e) => setNewDomainCat(e.target.value)}
              className="rounded-xl border border-slate-300 px-3 py-2 text-xs"
            >
              <option value="IT">IT</option>
              <option value="MANAGEMENT">MANAGEMENT</option>
            </select>
            <button type="submit" className="rounded-full bg-[#0A192F] px-4 py-2 text-xs font-bold text-white">
              Add
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {careersData.domains.map((d) => (
              <span key={d.id} className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px]">
                {d.name} {d.isAutoCreated && "(Auto)"}
              </span>
            ))}
          </div>
        </form>

        <form onSubmit={handleAddJob} className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
          <div className="text-xs font-bold uppercase text-[#1D4ED8]">Publish Open Career Role</div>
          <div className="grid grid-cols-2 gap-2">
            <input
              required
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              placeholder="Role Title *"
              className="rounded-xl border border-slate-300 px-3 py-2 text-xs"
            />
            <select
              value={jobDomainSlug}
              onChange={(e) => setJobDomainSlug(e.target.value)}
              className="rounded-xl border border-slate-300 px-3 py-2 text-xs"
            >
              {careersData.domains.map((d) => (
                <option key={d.id} value={d.slug}>
                  {d.name}
                </option>
              ))}
            </select>
            <input
              value={jobExp}
              onChange={(e) => setJobExp(e.target.value)}
              placeholder="Experience (e.g. 4+ years)"
              className="rounded-xl border border-slate-300 px-3 py-2 text-xs"
            />
            <input
              value={jobSkills}
              onChange={(e) => setJobSkills(e.target.value)}
              placeholder="Skills (comma separated)"
              className="rounded-xl border border-slate-300 px-3 py-2 text-xs"
            />
          </div>
          <button
            type="submit"
            className="inline-flex items-center gap-1 rounded-full bg-[#0A192F] px-4 py-2 text-xs font-bold text-white"
          >
            <Plus className="h-3.5 w-3.5" /> Publish Role
          </button>
        </form>
      </div>

      {/* Candidate Screening Queue */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
        <h3 className="font-heading text-base font-bold text-[#0A0F1A]">
          Candidate Screening Queue ({careersData.applications.length})
        </h3>
        <div className="divide-y divide-slate-100">
          {careersData.applications.map((app) => (
            <div key={app.id} className="py-4 flex flex-wrap items-center justify-between gap-4 text-xs">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <strong className="text-sm text-[#0A0F1A]">{app.applicantName}</strong>
                  <span className="text-slate-500">({app.applicantEmail})</span>
                  <span className="rounded-full bg-[#0A192F]/10 px-2.5 py-0.5 font-semibold text-[#0A192F]">
                    {app.domainName}
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-0.5 font-bold ${
                      app.screeningStatus === "CONVERTED"
                        ? "bg-emerald-100 text-emerald-800"
                        : app.screeningStatus === "APPROVED"
                        ? "bg-sky-100 text-sky-800"
                        : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {app.screeningStatus}
                  </span>
                </div>
                <div className="text-slate-600">
                  {app.yearsExperience} yrs exp · Consent to Anonymize:{" "}
                  <strong>{app.consentToProfile ? "YES" : "NO"}</strong> · Skills:{" "}
                  {JSON.parse(app.skillsJson || "[]").join(", ")}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {app.cvFileUrl && (
                  <a
                    href={app.cvFileUrl}
                    className="inline-flex items-center gap-1 rounded-full border border-slate-300 px-3 py-1.5 font-semibold"
                  >
                    <Download className="h-3 w-3" /> CV
                  </a>
                )}
                {app.screeningStatus !== "CONVERTED" && (
                  <>
                    <select
                      value={app.screeningStatus}
                      onChange={(e) => updateScreeningStatus(app.id, e.target.value)}
                      className="rounded-lg border border-slate-300 px-2.5 py-1.5 font-semibold"
                    >
                      <option value="NEW">NEW</option>
                      <option value="SCREENING">SCREENING</option>
                      <option value="APPROVED">APPROVED</option>
                      <option value="REJECTED">REJECTED</option>
                    </select>
                    {app.consentToProfile && (
                      <button
                        type="button"
                        onClick={() => {
                          setConvertApp(app);
                          setConvertRoleTitle(`Senior ${app.domainName} Specialist`);
                          setConvertRate(String(app.expectedMonthlyRateUsd || 4800));
                        }}
                        className="inline-flex items-center gap-1 rounded-full bg-emerald-700 px-3.5 py-1.5 font-bold text-white hover:bg-emerald-800"
                      >
                        <Sparkles className="h-3.5 w-3.5" /> Convert to Live Profile
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modal: Convert Consented Applicant into Anonymized Real Profile */}
      {convertApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <form
            onSubmit={handleConvertSubmit}
            className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl space-y-4"
          >
            <h3 className="font-heading text-lg font-bold text-[#0A0F1A]">
              Convert Applicant to Live Anonymized Profile
            </h3>
            <p className="text-xs text-slate-600">
              Strips <strong>{convertApp.applicantName}</strong>&apos;s name, email, phone, and CV. Publishes strictly anonymized skills, experience, and domain under a new Profile ID flagged <strong>REAL</strong>.
            </p>
            <div>
              <label className="block text-xs font-semibold mb-1">Anonymized Role Title</label>
              <input
                required
                value={convertRoleTitle}
                onChange={(e) => setConvertRoleTitle(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Client Monthly Rate (USD)</label>
              <input
                required
                type="number"
                value={convertRate}
                onChange={(e) => setConvertRate(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">
                Replace a Sample Profile (optional — improves Real/Sample ratio)
              </label>
              <select
                value={replaceSampleId}
                onChange={(e) => setReplaceSampleId(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
              >
                <option value="">Keep all sample profiles (add alongside)</option>
                {careersData.sampleProfiles.map((sp) => (
                  <option key={sp.id} value={sp.id}>
                    Retire {sp.profileCode} — {sp.roleTitle}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConvertApp(null)}
                className="rounded-full border border-slate-300 px-4 py-2 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-full bg-[#0A192F] px-5 py-2 text-xs font-bold text-white"
              >
                Publish Anonymized REAL Profile
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

