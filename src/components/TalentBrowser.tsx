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
  User,
  Mail,
  Phone,
  MapPin,
  Award,
  Code2,
  FileText,
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
        const hay = `${p.profileCode} ${p.roleTitle} ${p.domainName} ${p.summary} ${p.skills.join(" ")}`.toLowerCase();
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
              Every specialist is listed strictly by their Staff Profile ID, skills, experience, and anonymized projects—while names, photos, CVs, and contact details remain locked until Admin approval. Click <strong>Request Full Profile</strong> to initiate dossier release.
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
                  {p.profileCode}
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
              <span className="text-[11px] font-medium text-slate-500">
                Protected CV Preview
              </span>
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

      {/* Modal: Authentic A4 CV Sheet (Personal Info Blurred) + Request Full Profile */}
      {selectedProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-3 sm:p-5 backdrop-blur-sm">
          <div className="w-full max-w-3xl max-h-[92vh] overflow-y-auto rounded-2xl bg-slate-100 border border-slate-300 shadow-2xl">
            {/* Modal Top Bar */}
            <div className="sticky top-0 z-20 bg-[#0A192F] text-white px-5 sm:px-6 py-3.5 flex items-center justify-between border-b border-white/10">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="inline-flex items-center gap-1.5 text-xs font-bold bg-white/15 px-2.5 py-1 rounded">
                  <FileText className="h-3.5 w-3.5 text-sky-300" />
                  {selectedProfile.profileCode}
                </span>
                <span className="text-xs font-medium text-sky-300">
                  {selectedProfile.domainName} · Protected A4 Curriculum Vitae
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedProfile(null)}
                aria-label="Close CV preview"
                className="rounded-lg p-1.5 hover:bg-white/10 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-4 sm:p-7 space-y-5">
              {/* A4 Paper Sheet */}
              <div className="mx-auto w-full max-w-[680px] bg-white border border-slate-200/90 shadow-[0_8px_30px_rgb(15,23,42,0.12)] rounded-sm overflow-hidden">
                {/* Subtle A4 Accent Rule */}
                <div className="h-1.5 w-full bg-gradient-to-r from-[#0A192F] via-[#1D4ED8] to-[#0A192F]" />

                {/* CV Header Block: Staff ID & Role visible; Personal Info Redacted/Blurred */}
                <div className="px-6 sm:px-9 pt-7 pb-6 border-b border-slate-200 bg-gradient-to-b from-slate-50/70 to-white">
                  <div className="flex items-start gap-4">
                    {/* Blurred Avatar Silhouette */}
                    <div className="relative h-16 w-16 shrink-0 rounded-full border border-slate-300 bg-slate-200/80 flex items-center justify-center overflow-hidden">
                      <User className="h-9 w-9 text-slate-500 blur-[4px] select-none" />
                      <span
                        title="Candidate photo redacted until NDA approval"
                        className="absolute bottom-0.5 right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#0A192F] text-white shadow"
                      >
                        <Lock className="h-2.5 w-2.5" />
                      </span>
                    </div>

                    <div className="space-y-1.5 min-w-0 flex-1">
                      {/* Crisp Public Role Title */}
                      <h3 className="font-heading text-lg sm:text-xl font-bold text-[#0A0F1A] leading-snug">
                        {selectedProfile.roleTitle}
                      </h3>

                      {/* Blurred Name Placeholder */}
                      <div className="flex items-center gap-2 pt-0.5">
                        <span
                          aria-hidden="true"
                          className="font-heading text-base font-bold tracking-tight text-slate-700 blur-[5.5px] select-none pointer-events-none"
                        >
                          Candidate Full Name Hidden
                        </span>
                      </div>

                      {/* Blurred Contact Details Row (Zero real PII in DOM) */}
                      <div
                        aria-hidden="true"
                        className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-0.5 text-[11px] text-slate-600 blur-[4.5px] select-none pointer-events-none"
                      >
                        <span className="inline-flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          candidate.profile@viacodos-private.lk
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          +94 77 000 0000
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          Colombo / Galle, Sri Lanka
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Highlight Bar */}
                  <div className="mt-5 grid grid-cols-3 gap-3 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-xs">
                    <div>
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">
                        Commercial Experience
                      </span>
                      <span className="font-bold text-[#0A0F1A]">
                        {selectedProfile.yearsExperience}+ Years
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">
                        Availability
                      </span>
                      <span className="font-bold text-emerald-700">
                        {selectedProfile.availability.replace("_", " ")}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">
                        Practice Domain
                      </span>
                      <span className="font-bold text-[#0A192F] truncate block">
                        {selectedProfile.domainName}
                      </span>
                    </div>
                  </div>
                </div>

                {/* A4 Document Sections */}
                <div className="px-6 sm:px-9 py-6 space-y-6">
                  {/* 1. Experience Profile */}
                  <section className="space-y-2">
                    <h4 className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-[#0A192F] border-b border-slate-200 pb-1.5">
                      <Briefcase className="h-3.5 w-3.5 text-[#1D4ED8]" />
                      Professional Experience Summary
                    </h4>
                    <p className="text-[13px] text-slate-700 leading-relaxed">
                      {selectedProfile.summary}
                    </p>
                    {selectedProfile.industries.length > 0 && (
                      <div className="pt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-600">
                        <span className="font-semibold text-slate-500 mr-1">Industries:</span>
                        {selectedProfile.industries.map((ind) => (
                          <span
                            key={ind}
                            className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[11px] font-medium text-slate-700"
                          >
                            {ind}
                          </span>
                        ))}
                      </div>
                    )}
                  </section>

                  {/* 2. Core Technical Stack */}
                  <section className="space-y-2.5">
                    <h4 className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-[#0A192F] border-b border-slate-200 pb-1.5">
                      <Code2 className="h-3.5 w-3.5 text-[#1D4ED8]" />
                      Core Tech Stack &amp; Competencies
                    </h4>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedProfile.skills.map((s) => (
                        <span
                          key={s}
                          className="rounded-md border border-slate-200 bg-[#F8FAFC] px-2.5 py-1 text-xs font-semibold text-[#0A192F]"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  </section>

                  {/* 3. Projects Already Delivered */}
                  <section className="space-y-3">
                    <h4 className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-[#0A192F] border-b border-slate-200 pb-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5 text-[#1D4ED8]" />
                      Key Delivered Projects &amp; Production Track Record
                    </h4>
                    <div className="space-y-3.5">
                      {selectedProfile.projects.map((proj, idx) => (
                        <div
                          key={idx}
                          className="relative pl-4 border-l-2 border-[#1D4ED8]/40 space-y-1.5 pb-1"
                        >
                          <div className="flex flex-wrap items-baseline justify-between gap-2">
                            <div className="font-bold text-sm text-[#0A192F]">{proj.title}</div>
                            <span
                              aria-hidden="true"
                              className="text-[11px] text-slate-500 blur-[4px] select-none pointer-events-none"
                            >
                              Enterprise Client Corp.
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 leading-relaxed">{proj.scope}</p>
                          <p className="text-xs font-semibold text-emerald-700">
                            Outcome: {proj.outcome}
                          </p>
                          {proj.stack && proj.stack.length > 0 && (
                            <div className="flex flex-wrap gap-1 pt-0.5">
                              {proj.stack.map((tech) => (
                                <span
                                  key={tech}
                                  className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700"
                                >
                                  {tech}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </section>

                  {/* 4. Vetting & Masked Personal Background Footer */}
                  <section className="rounded-xl border border-slate-200 bg-[#F8FAFC] p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#0A192F]">
                        <Award className="h-3.5 w-3.5 text-[#1D4ED8]" />
                        Via Codos Verification
                      </div>
                      <p className="text-xs text-slate-600">
                        4-Stage Vetted Specialist · Live Technical Screen, Architecture Review &amp; Background Checked
                      </p>
                    </div>
                    <div className="space-y-1 border-t sm:border-t-0 sm:border-l border-slate-200 pt-3 sm:pt-0 sm:pl-4">
                      <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        <Lock className="h-3 w-3" />
                        Education, ID &amp; References
                      </div>
                      <div
                        aria-hidden="true"
                        className="text-xs text-slate-600 blur-[4.5px] select-none pointer-events-none space-y-0.5"
                      >
                        <div>B.Sc. Computer Science · University Institute</div>
                        <div>NIC / Passport &amp; 2 Senior Engineering Referees</div>
                      </div>
                    </div>
                  </section>
                </div>

                {/* A4 Sheet Bottom Margin Stamp */}
                <div className="border-t border-slate-100 bg-slate-50/70 px-6 sm:px-9 py-2.5 flex items-center justify-between text-[10px] text-slate-400">
                  <span>Via Codos (PVT) LTD · Standardized Talent Dossier ({selectedProfile.profileCode})</span>
                  <span className="inline-flex items-center gap-1 text-slate-500 font-medium">
                    <Lock className="h-2.5 w-2.5" /> Identity &amp; contact unblurred upon NDA approval
                  </span>
                </div>
              </div>

              {/* Request Full Profile Action */}
              <div className="mx-auto w-full max-w-[680px] rounded-xl border border-[#0A192F]/20 bg-white p-5 shadow-sm space-y-3">
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

