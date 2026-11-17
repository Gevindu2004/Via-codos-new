"use client";

import React, { useState } from "react";
import { Upload, CheckCircle2, Sparkles, Briefcase, MapPin } from "lucide-react";

interface JobPostingView {
  id: string;
  title: string;
  domainSlug: string;
  domainName: string;
  employmentType: string;
  location: string;
  experienceRequired: string;
  skills: string[];
  responsibilities: string[];
}

interface JobDomainView {
  slug: string;
  name: string;
  category: string;
}

export function CareersApplyClient({
  jobs,
  domains,
}: {
  jobs: JobPostingView[];
  domains: JobDomainView[];
}) {
  const [selectedJobId, setSelectedJobId] = useState<string>("");
  const [applicantName, setApplicantName] = useState("");
  const [applicantEmail, setApplicantEmail] = useState("");
  const [applicantPhone, setApplicantPhone] = useState("");
  const [portfolioUrl, setPortfolioUrl] = useState("");
  const [selectedDomain, setSelectedDomain] = useState(domains[0]?.name || "Software Engineering");
  const [isNewDomain, setIsNewDomain] = useState(false);
  const [customDomainName, setCustomDomainName] = useState("");
  const [domainCategory, setDomainCategory] = useState<"IT" | "MANAGEMENT">("IT");
  const [skills, setSkills] = useState("");
  const [yearsExperience, setYearsExperience] = useState(3);
  const [expectedMonthlyRateUsd, setExpectedMonthlyRateUsd] = useState("");
  const [summary, setSummary] = useState("");
  const [consentToProfile, setConsentToProfile] = useState(true);
  const [cvFile, setCvFile] = useState<File | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<{
    domainName: string;
    autoCreatedDomain: boolean;
  } | null>(null);

  const handleApplyToRole = (job: JobPostingView) => {
    setSelectedJobId(job.id);
    setIsNewDomain(false);
    setSelectedDomain(job.domainName);
    setSkills(job.skills.join(", "));
    const el = document.getElementById("candidate-application-form");
    el?.scrollIntoView({ behavior: "smooth" });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("applicantName", applicantName);
      fd.append("applicantEmail", applicantEmail);
      fd.append("applicantPhone", applicantPhone);
      fd.append("portfolioUrl", portfolioUrl);
      if (selectedJobId) fd.append("jobPostingId", selectedJobId);
      fd.append("selectedDomain", selectedDomain);
      if (isNewDomain && customDomainName.trim()) {
        fd.append("customDomainName", customDomainName.trim());
      }
      fd.append("domainCategory", domainCategory);
      fd.append("skills", skills);
      fd.append("yearsExperience", String(yearsExperience));
      if (expectedMonthlyRateUsd) fd.append("expectedMonthlyRateUsd", expectedMonthlyRateUsd);
      fd.append("summary", summary);
      fd.append("consentToProfile", consentToProfile ? "true" : "false");
      if (cvFile) fd.append("cv", cvFile);

      const res = await fetch("/api/careers/apply", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Application failed.");
      } else {
        setSuccessInfo({
          domainName: data.domainName,
          autoCreatedDomain: data.autoCreatedDomain,
        });
      }
    } catch {
      setError("Network error submitting application.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-16">
      {/* Open Positions */}
      <div>
        <div className="mb-6">
          <span className="text-xs font-bold uppercase tracking-[0.18em] text-[#1D4ED8]">
            Open Positions
          </span>
          <h2 className="font-heading mt-1 text-2xl sm:text-3xl font-extrabold text-[#0A0F1A]">
            Current Opportunities Across Domains
          </h2>
        </div>

        <div className="space-y-4">
          {jobs.map((job) => (
            <div
              key={job.id}
              className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:border-[#0A192F] transition"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <span className="inline-block rounded-full bg-[#0A192F]/5 px-3 py-0.5 text-[11px] font-bold text-[#1D4ED8]">
                    {job.domainName}
                  </span>
                  <h3 className="font-heading mt-2 text-xl font-bold text-[#0A0F1A]">
                    {job.title}
                  </h3>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                    <span className="inline-flex items-center gap-1">
                      <Briefcase className="h-3.5 w-3.5" /> {job.employmentType}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" /> {job.location}
                    </span>
                    <span>• {job.experienceRequired}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleApplyToRole(job)}
                  className="rounded-full bg-[#0A192F] px-5 py-2.5 text-xs font-bold text-white hover:bg-[#1E3A8A] shrink-0"
                >
                  Apply for This Role →
                </button>
              </div>

              <div className="mt-4 flex flex-wrap gap-1.5">
                {job.skills.map((s) => (
                  <span key={s} className="rounded-md bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-700">
                    {s}
                  </span>
                ))}
              </div>

              {job.responsibilities.length > 0 && (
                <ul className="mt-4 space-y-1 text-xs text-slate-600 list-disc list-inside">
                  {job.responsibilities.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Candidate Application Form (CV Upload, Skills, Experience, Auto-Domain Creation, Consent) */}
      <div id="candidate-application-form" className="rounded-2xl border border-slate-200 bg-[#F8FAFC] p-6 sm:p-10">
        {successInfo ? (
          <div className="text-center max-w-xl mx-auto py-8 space-y-4">
            <div className="mx-auto h-14 w-14 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h3 className="font-heading text-2xl font-extrabold text-[#0A0F1A]">
              Application Received into Screening Queue
            </h3>
            <p className="text-sm text-slate-600">
              Thank you, <strong>{applicantName}</strong>. Your CV and profile have been submitted under the{" "}
              <strong>{successInfo.domainName}</strong> domain.
              {successInfo.autoCreatedDomain &&
                " (A new domain was automatically registered for your specialization!)"}
            </p>
            <button
              type="button"
              onClick={() => {
                setSuccessInfo(null);
                setApplicantName("");
                setApplicantEmail("");
                setSkills("");
                setSummary("");
                setCvFile(null);
              }}
              className="rounded-full bg-[#0A192F] px-5 py-2.5 text-xs font-semibold text-white"
            >
              Submit Another Application
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.18em] text-[#1D4ED8]">
                <Sparkles className="h-4 w-4" />
                Candidate Application &amp; Talent Pool Pipeline
              </span>
              <h2 className="font-heading mt-1 text-2xl font-extrabold text-[#0A0F1A]">
                Apply to Join Via Codos
              </h2>
              <p className="text-xs text-slate-600 mt-1">
                Don&apos;t see your exact domain? Choose &ldquo;Create New Domain&rdquo; below — our system automatically registers new domains as candidates apply.
              </p>
            </div>

            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-red-700">
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#0A0F1A] mb-1">
                  Full Name *
                </label>
                <input
                  required
                  type="text"
                  value={applicantName}
                  onChange={(e) => setApplicantName(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm focus:border-[#0A192F] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#0A0F1A] mb-1">
                  Email Address *
                </label>
                <input
                  required
                  type="email"
                  value={applicantEmail}
                  onChange={(e) => setApplicantEmail(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm focus:border-[#0A192F] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#0A0F1A] mb-1">
                  Phone / WhatsApp
                </label>
                <input
                  type="text"
                  value={applicantPhone}
                  onChange={(e) => setApplicantPhone(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm focus:border-[#0A192F] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#0A0F1A] mb-1">
                  GitHub / LinkedIn / Portfolio URL
                </label>
                <input
                  type="text"
                  value={portfolioUrl}
                  onChange={(e) => setPortfolioUrl(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm focus:border-[#0A192F] focus:outline-none"
                />
              </div>
            </div>

            {/* Domain Selection or Auto-Create New Domain */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="text-xs font-bold text-[#0A0F1A]">Job Domain *</label>
                <button
                  type="button"
                  onClick={() => setIsNewDomain(!isNewDomain)}
                  className="text-xs font-semibold text-[#1D4ED8] hover:underline"
                >
                  {isNewDomain ? "Select existing domain" : "+ Apply under a new domain"}
                </button>
              </div>

              {isNewDomain ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    required
                    type="text"
                    value={customDomainName}
                    onChange={(e) => setCustomDomainName(e.target.value)}
                    placeholder="Enter new domain (e.g. SAP ABAP, Embedded Rust)"
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm focus:border-[#0A192F] focus:outline-none"
                  />
                  <select
                    value={domainCategory}
                    onChange={(e) => setDomainCategory(e.target.value as "IT" | "MANAGEMENT")}
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm focus:border-[#0A192F] focus:outline-none"
                  >
                    <option value="IT">IT &amp; Engineering Category</option>
                    <option value="MANAGEMENT">Management &amp; Operations Category</option>
                  </select>
                </div>
              ) : (
                <select
                  value={selectedDomain}
                  onChange={(e) => setSelectedDomain(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-[#0A192F] focus:outline-none"
                >
                  {domains.map((d) => (
                    <option key={d.slug} value={d.name}>
                      {d.name} ({d.category})
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-[#0A0F1A] mb-1">
                  Key Skills (comma separated) *
                </label>
                <input
                  required
                  type="text"
                  value={skills}
                  onChange={(e) => setSkills(e.target.value)}
                  placeholder="e.g. TypeScript, Next.js, AWS, COBOL, IFRS"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm focus:border-[#0A192F] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#0A0F1A] mb-1">
                  Years of Experience *
                </label>
                <input
                  required
                  type="number"
                  min={0}
                  max={45}
                  value={yearsExperience}
                  onChange={(e) => setYearsExperience(Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm focus:border-[#0A192F] focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#0A0F1A] mb-1">
                  Expected Monthly Rate (USD, optional)
                </label>
                <input
                  type="number"
                  value={expectedMonthlyRateUsd}
                  onChange={(e) => setExpectedMonthlyRateUsd(e.target.value)}
                  placeholder="e.g. 4500"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm focus:border-[#0A192F] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#0A0F1A] mb-1">
                  Upload CV / Resume (PDF, DOC, DOCX)
                </label>
                <label className="flex items-center gap-2 rounded-xl border border-dashed border-slate-400 bg-white px-3.5 py-2.5 text-xs text-slate-600 cursor-pointer hover:border-[#0A192F]">
                  <Upload className="h-4 w-4 text-[#1D4ED8] shrink-0" />
                  <span className="truncate">
                    {cvFile ? cvFile.name : "Choose CV file..."}
                  </span>
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx"
                    onChange={(e) => setCvFile(e.target.files?.[0] || null)}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#0A0F1A] mb-1">
                Professional Summary &amp; Key Projects
              </label>
              <textarea
                rows={3}
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="Summarize your core systems, notable achievements, and industries..."
                className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm focus:border-[#0A192F] focus:outline-none"
              />
            </div>

            <label className="flex items-start gap-2.5 rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={consentToProfile}
                onChange={(e) => setConsentToProfile(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[#0A192F]"
              />
              <span>
                <strong>Anonymized Talent Bench Consent:</strong> I consent to Via Codos screening my application and, upon approval, publishing an anonymized talent profile (Profile ID, skills, experience, and project track record — with my name, photo, and contact details removed).
              </span>
            </label>

            <button
              type="submit"
              disabled={submitting}
              className="w-full sm:w-auto rounded-full bg-[#0A192F] px-8 py-3.5 text-sm font-bold text-white hover:bg-[#1E3A8A] disabled:opacity-50 transition"
            >
              {submitting ? "Uploading CV & Submitting..." : "Submit Career Application"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

