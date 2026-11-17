"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import {
  Search,
  ShieldCheck,
  Briefcase,
  Clock,
  CheckCircle2,
  ArrowRight,
  Lock,
  Sparkles,
  X,
} from "lucide-react";
import type { PublicTalentProfile } from "@/lib/sanitize";

interface DomainItem {
  slug: string;
  name: string;
  category: string;
}

interface TalentBrowserProps {
  initialProfiles: PublicTalentProfile[];
  domains: DomainItem[];
  initialDomain?: string;
  isClientLoggedIn?: boolean;
  clientVerificationStatus?: string | null;
}

export function TalentBrowser({
  initialProfiles,
  domains,
  initialDomain = "ALL",
  isClientLoggedIn = false,
  clientVerificationStatus = null,
}: TalentBrowserProps) {
  const [category, setCategory] = useState<"ALL" | "IT" | "MANAGEMENT">(
    initialDomain !== "ALL"
      ? ((domains.find((d) => d.slug === initialDomain)?.category as "IT" | "MANAGEMENT") || "ALL")
      : "ALL"
  );
  const [domainSlug, setDomainSlug] = useState<string>(initialDomain);
  const [skillQuery, setSkillQuery] = useState("");
  const [minExperience, setMinExperience] = useState<number>(0);
  const [industryFilter, setIndustryFilter] = useState<string>("ALL");
  const [availabilityFilter, setAvailabilityFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProfile, setSelectedProfile] = useState<PublicTalentProfile | null>(null);

  // Request Full Profile state
  const [requestNotes, setRequestNotes] = useState("");
  const [submittingRequest, setSubmittingRequest] = useState(false);
  const [requestStatusMsg, setRequestStatusMsg] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const allIndustries = useMemo(() => {
    const set = new Set<string>();
    initialProfiles.forEach((p) => p.industries.forEach((i) => set.add(i)));
    return Array.from(set).sort();
  }, [initialProfiles]);

  const filteredDomains = useMemo(() => {
    if (category === "ALL") return domains;
    return domains.filter((d) => d.category === category);
  }, [domains, category]);

  const filteredProfiles = useMemo(() => {
    return initialProfiles.filter((p) => {
      if (category !== "ALL" && p.category !== category) return false;
      if (domainSlug !== "ALL" && p.domainSlug !== domainSlug) return false;
      if (minExperience > 0 && p.yearsExperience < minExperience) return false;
      if (availabilityFilter !== "ALL" && p.availability !== availabilityFilter) return false;
      if (
        industryFilter !== "ALL" &&
        !p.industries.some((i) => i.toLowerCase() === industryFilter.toLowerCase())
      ) {
        return false;
      }
      if (
        skillQuery.trim() &&
        !p.skills.some((s) => s.toLowerCase().includes(skillQuery.toLowerCase().trim()))
      ) {
        return false;
      }
      if (searchQuery.trim()) {
        const hay = `${p.profileCode} ${p.displayName || ""} ${p.roleTitle} ${p.domainName} ${p.summary} ${p.skills.join(" ")}`.toLowerCase();
        if (!hay.includes(searchQuery.toLowerCase().trim())) return false;
      }
      return true;
    });
  }, [
    initialProfiles,
    category,
    domainSlug,
    minExperience,
    availabilityFilter,
    industryFilter,
    skillQuery,
    searchQuery,
  ]);

  const handleRequestFullProfile = async () => {
    if (!selectedProfile) return;
    setSubmittingRequest(true);
    setRequestStatusMsg(null);
    try {
      const res = await fetch("/api/portal/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          talentId: selectedProfile.id,
          requestNotes,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setRequestStatusMsg({
          type: "error",
          text: data.error || "Unable to submit request. Please sign in to the Client Portal.",
        });
      } else {
        setRequestStatusMsg({
          type: "success",
          text: "Profile request submitted! It is now in your Client Portal pipeline awaiting Admin approval.",
        });
        setRequestNotes("");
      }
    } catch {
      setRequestStatusMsg({ type: "error", text: "Network error submitting request." });
    } finally {
      setSubmittingRequest(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Privacy & Anonymization Notice */}
      <div className="rounded-2xl border border-[#0A192F]/15 bg-[#F8FAFC] p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <Lock className="h-5 w-5 text-[#1D4ED8] mt-0.5 shrink-0" />
          <div>
            <div className="text-sm font-bold text-[#0A0F1A]">
              Protected Talent Bench — Contact Details &amp; Photos Restricted Until Approved
            </div>
            <p className="text-xs text-slate-600 mt-0.5">
              Every specialist is listed with their Profile ID, name, skills, experience, anonymized projects, and rate—while photos, CVs, and contact details remain locked until Admin approval. Click <strong>Request Full Profile</strong> to initiate dossier release.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link
            href="/staff-augmentation/request"
            className="rounded-full bg-[#0A192F] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1E3A8A] transition"
          >
            Custom Team Request →
          </Link>
        </div>
      </div>

      {/* Category Switcher + Domain Quick Links */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="inline-flex rounded-full border border-slate-200 bg-slate-100 p-1">
          {[
            { id: "ALL", label: `All Talent (${initialProfiles.length})` },
            {
              id: "IT",
              label: `IT & Legacy Engineering (${
                initialProfiles.filter((p) => p.category === "IT").length
              })`,
            },
            {
              id: "MANAGEMENT",
              label: `Management & Ops (${
                initialProfiles.filter((p) => p.category === "MANAGEMENT").length
              })`,
            },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setCategory(tab.id as "ALL" | "IT" | "MANAGEMENT");
                setDomainSlug("ALL");
              }}
              className={`rounded-full px-4 py-1.5 text-xs font-semibold transition ${
                category === tab.id
                  ? "bg-[#0A192F] text-white shadow-sm"
                  : "text-slate-600 hover:text-[#0A0F1A]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="text-xs font-semibold text-slate-500">
          Showing <span className="text-[#0A0F1A]">{filteredProfiles.length}</span> profiles
        </div>
      </div>

      {/* Filter Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="lg:col-span-2 relative">
          <Search className="h-4 w-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search Profile ID, role, COBOL, AWS, IFRS..."
            className="w-full rounded-xl border border-slate-200 pl-9 pr-3 py-2 text-xs focus:border-[#0A192F] focus:outline-none"
          />
        </div>

        <select
          value={domainSlug}
          onChange={(e) => setDomainSlug(e.target.value)}
          className="rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-700 focus:border-[#0A192F] focus:outline-none"
        >
          <option value="ALL">All Domains</option>
          {filteredDomains.map((d) => (
            <option key={d.slug} value={d.slug}>
              {d.name}
            </option>
          ))}
        </select>

        <input
          type="text"
          value={skillQuery}
          onChange={(e) => setSkillQuery(e.target.value)}
          placeholder="Filter by skill (e.g. RPGLE)"
          className="rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-[#0A192F] focus:outline-none"
        />

        <select
          value={minExperience}
          onChange={(e) => setMinExperience(Number(e.target.value))}
          className="rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-700 focus:border-[#0A192F] focus:outline-none"
        >
          <option value={0}>Any Experience</option>
          <option value={3}>3+ Years</option>
          <option value={5}>5+ Years</option>
          <option value={8}>8+ Years</option>
          <option value={10}>10+ Years</option>
        </select>

        <div className="grid grid-cols-2 gap-2">
          <select
            value={industryFilter}
            onChange={(e) => setIndustryFilter(e.target.value)}
            className="rounded-xl border border-slate-200 px-2.5 py-2 text-xs text-slate-700 focus:border-[#0A192F] focus:outline-none"
          >
            <option value="ALL">Industry</option>
            {allIndustries.map((ind) => (
              <option key={ind} value={ind}>
                {ind}
              </option>
            ))}
          </select>

          <select
            value={availabilityFilter}
            onChange={(e) => setAvailabilityFilter(e.target.value)}
            className="rounded-xl border border-slate-200 px-2.5 py-2 text-xs text-slate-700 focus:border-[#0A192F] focus:outline-none"
          >
            <option value="ALL">Availability</option>
            <option value="IMMEDIATE">Immediate</option>
            <option value="TWO_WEEKS">2 Weeks</option>
            <option value="ONE_MONTH">1 Month</option>
            <option value="PART_TIME">Part-Time</option>
          </select>
        </div>
      </div>

      {/* Domain Pills */}
      <div className="flex flex-wrap gap-2">
        <Link
          href="/talent"
          className={`rounded-full px-3 py-1 text-[11px] font-semibold border transition ${
            domainSlug === "ALL"
              ? "bg-[#0A192F] text-white border-[#0A192F]"
              : "bg-white text-slate-600 border-slate-200 hover:border-[#0A192F]"
          }`}
        >
          All Domains
        </Link>
        {filteredDomains.map((d) => (
          <Link
            key={d.slug}
            href={`/talent/${d.slug}`}
            onClick={(e) => {
              e.preventDefault();
              setDomainSlug(d.slug);
            }}
            className={`rounded-full px-3 py-1 text-[11px] font-semibold border transition ${
              domainSlug === d.slug
                ? "bg-[#0A192F] text-white border-[#0A192F]"
                : "bg-white text-slate-600 border-slate-200 hover:border-[#0A192F]"
            }`}
          >
            {d.name}
          </Link>
        ))}
      </div>

      {/* Profiles Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredProfiles.map((p) => (
          <div
            key={p.id}
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col justify-between hover:border-[#0A192F] hover:shadow-md transition"
          >
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-white bg-[#0A192F] px-3 py-1 rounded-md">
                  {p.displayName || p.profileCode}
                </span>
                {p.placementStatus === "PLACED" && (
                  <span className="rounded-full bg-amber-100 text-amber-800 px-2.5 py-0.5 text-[10px] font-bold uppercase">
                    Placed
                  </span>
                )}
              </div>

              <div className="mt-3 text-[11px] font-semibold uppercase tracking-wider text-[#1D4ED8]">
                {p.domainName}
              </div>
              <h3 className="font-heading mt-1 text-base font-bold text-[#0A0F1A] leading-snug">
                {p.roleTitle}
              </h3>

              <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-600">
                <span className="inline-flex items-center gap-1 font-medium">
                  <Briefcase className="h-3.5 w-3.5 text-[#0A192F]" />
                  {p.yearsExperience} yrs exp
                </span>
                <span className="inline-flex items-center gap-1 font-medium">
                  <Clock className="h-3.5 w-3.5 text-[#0A192F]" />
                  {p.availability.replace("_", " ")}
                </span>
              </div>

              <p className="mt-3 text-xs text-slate-600 leading-relaxed line-clamp-3">
                {p.summary}
              </p>

              <div className="mt-4 flex flex-wrap gap-1.5">
                {p.skills.slice(0, 6).map((sk) => (
                  <span
                    key={sk}
                    className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700"
                  >
                    {sk}
                  </span>
                ))}
              </div>
            </div>

            <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-bold text-[#0A0F1A]">
                  ${p.monthlyRateUsd.toLocaleString()}/mo
                </div>
                <div className="text-[10px] text-slate-500">${p.hourlyRateUsd}/hr equiv.</div>
              </div>
              <button
                type="button"
                disabled={p.placementStatus === "PLACED"}
                onClick={() => {
                  setSelectedProfile(p);
                  setRequestStatusMsg(null);
                }}
                className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold transition ${
                  p.placementStatus === "PLACED"
                    ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                    : "bg-[#0A192F] text-white hover:bg-[#1E3A8A]"
                }`}
              >
                {p.placementStatus === "PLACED" ? "Placed" : "Request Full Profile"}
                {p.placementStatus !== "PLACED" && <ArrowRight className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Modal: Anonymized Projects Preview + Request Full Profile */}
      {selectedProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white border border-slate-200 shadow-2xl">
            <div className="sticky top-0 bg-[#0A192F] text-white px-6 py-4 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold bg-white/15 px-2.5 py-0.5 rounded">
                    {selectedProfile.displayName || selectedProfile.profileCode}
                  </span>
                  <span className="text-xs text-sky-300">{selectedProfile.domainName}</span>
                </div>
                <h3 className="font-heading text-lg font-bold mt-1">
                  {selectedProfile.roleTitle}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedProfile(null)}
                className="rounded-lg p-1.5 hover:bg-white/10"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div className="grid grid-cols-3 gap-3 rounded-xl bg-[#F8FAFC] p-4 border border-slate-200 text-center">
                <div>
                  <div className="text-[11px] text-slate-500">Experience</div>
                  <div className="font-bold text-sm text-[#0A0F1A]">
                    {selectedProfile.yearsExperience} Years
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-500">Availability</div>
                  <div className="font-bold text-sm text-[#0A0F1A]">
                    {selectedProfile.availability.replace("_", " ")}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-500">Monthly Rate</div>
                  <div className="font-bold text-sm text-[#1D4ED8]">
                    ${selectedProfile.monthlyRateUsd.toLocaleString()} USD
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                  Anonymized Summary &amp; Core Skills
                </h4>
                <p className="text-sm text-slate-700 leading-relaxed">{selectedProfile.summary}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {selectedProfile.skills.map((s) => (
                    <span
                      key={s}
                      className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-[#0A0F1A]"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                  Anonymized Project Track Record
                </h4>
                <div className="space-y-3">
                  {selectedProfile.projects.map((proj, idx) => (
                    <div
                      key={idx}
                      className="rounded-xl border border-slate-200 bg-white p-4 space-y-1.5"
                    >
                      <div className="font-semibold text-sm text-[#0A192F]">{proj.title}</div>
                      <p className="text-xs text-slate-600">{proj.scope}</p>
                      <p className="text-xs font-medium text-emerald-700">
                        Outcome: {proj.outcome}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Request Full Profile Action */}
              <div className="rounded-xl border border-[#0A192F]/20 bg-[#F8FAFC] p-5 space-y-3">
                <div className="flex items-center gap-2 text-sm font-bold text-[#0A192F]">
                  <ShieldCheck className="h-4 w-4 text-[#1D4ED8]" />
                  Request Full Profile &amp; Start Client Pipeline
                </div>
                {isClientLoggedIn ? (
                  <>
                    {clientVerificationStatus !== "VERIFIED" && (
                      <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
                        Your company verification is currently <strong>{clientVerificationStatus}</strong>. You can submit this request now; admin will verify your company before releasing full profile details.
                      </div>
                    )}
                    <textarea
                      value={requestNotes}
                      onChange={(e) => setRequestNotes(e.target.value)}
                      rows={2}
                      placeholder="Optional: describe project scope, target start date, or preferred timezone overlap..."
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs focus:border-[#0A192F] focus:outline-none"
                    />
                    {requestStatusMsg && (
                      <div
                        className={`rounded-lg px-3 py-2 text-xs font-medium ${
                          requestStatusMsg.type === "success"
                            ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                            : "bg-red-50 text-red-800 border border-red-200"
                        }`}
                      >
                        {requestStatusMsg.text}
                        {requestStatusMsg.type === "success" && (
                          <Link href="/portal" className="ml-2 underline font-bold">
                            View Pipeline →
                          </Link>
                        )}
                      </div>
                    )}
                    <div className="flex items-center justify-end gap-3">
                      <button
                        type="button"
                        onClick={handleRequestFullProfile}
                        disabled={submittingRequest}
                        className="inline-flex items-center gap-2 rounded-full bg-[#0A192F] px-5 py-2.5 text-xs font-bold text-white hover:bg-[#1E3A8A] disabled:opacity-50"
                      >
                        {submittingRequest ? "Submitting..." : "Confirm Request Full Profile"}
                        <Sparkles className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="space-y-3">
                    <p className="text-xs text-slate-600">
                      To protect candidate privacy, full profile dossiers, AI interviews, and management meetings require a registered Client Portal account with company verification.
                    </p>
                    <div className="flex flex-wrap gap-2.5">
                      <Link
                        href={`/portal/login?next=/talent`}
                        className="inline-flex items-center gap-1.5 rounded-full bg-[#0A192F] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1E3A8A]"
                      >
                        Client Login
                      </Link>
                      <Link
                        href="/portal/register"
                        className="inline-flex items-center gap-1.5 rounded-full border border-[#0A192F] px-4 py-2 text-xs font-semibold text-[#0A192F] hover:bg-slate-100"
                      >
                        Register &amp; Verify Company
                      </Link>
                      <Link
                        href={`/staff-augmentation/request?profile=${selectedProfile.profileCode}`}
                        className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-white"
                      >
                        Quick Guest Inquiry
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

