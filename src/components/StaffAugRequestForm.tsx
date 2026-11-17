"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, ArrowRight } from "lucide-react";

export function StaffAugRequestForm() {
  const searchParams = useSearchParams();
  const prefillProfile = searchParams.get("profile") || "";

  const [form, setForm] = useState({
    name: "",
    email: "",
    company: "",
    phone: "",
    serviceLine: "IT Outsourcing & Staff Augmentation",
    domain: "Software Engineering",
    roleNeeded: prefillProfile ? `Inquiry regarding Profile ${prefillProfile}` : "",
    skillsText: "",
    headcount: 1,
    engagementModel: "Dedicated Full-Time",
    timeline: "Immediate (1–2 weeks)",
    timezoneOverlap: "4–8 Hours UK / EU / US Overlap",
    message: "",
    ndaRequired: true,
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [referenceCode, setReferenceCode] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/staffing-inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to submit inquiry.");
      } else {
        setReferenceCode(data.referenceCode);
      }
    } catch {
      setError("Network error submitting inquiry.");
    } finally {
      setSubmitting(false);
    }
  };

  if (referenceCode) {
    return (
      <div className="mx-auto max-w-2xl rounded-2xl border border-emerald-200 bg-white p-8 shadow-lg text-center space-y-5">
        <div className="mx-auto h-14 w-14 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
          <CheckCircle2 className="h-8 w-8" />
        </div>
        <div className="inline-block rounded-full bg-[#0A192F] px-4 py-1 font-mono text-xs font-bold text-sky-300">
          Reference: {referenceCode}
        </div>
        <h2 className="font-heading text-2xl font-extrabold text-[#0A0F1A]">
          Staff Augmentation Request Confirmed
        </h2>
        <p className="text-sm text-slate-600 leading-relaxed">
          Thank you, <strong>{form.name}</strong>. The Via Codos delivery and talent acquisition team has logged your requirements and will contact you shortly at <strong>{form.email}</strong> with matching vetted engineering or management resources.
        </p>
        <div className="pt-4 flex flex-wrap justify-center gap-3">
          <Link
            href="/talent"
            className="rounded-full bg-[#0A192F] px-5 py-2.5 text-xs font-semibold text-white hover:bg-[#1E3A8A]"
          >
            Browse Anonymized Talent Bench
          </Link>
          <Link
            href="/portal/register"
            className="rounded-full border border-slate-300 px-5 py-2.5 text-xs font-semibold text-[#0A0F1A] hover:border-[#0A192F]"
          >
            Create Client Portal Account
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm space-y-6"
    >
      <div className="border-b border-slate-100 pb-4">
        <h2 className="font-heading text-xl font-bold text-[#0A0F1A]">
          Structured Engineer &amp; Specialist Request
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Specify your required stack, seniority, timezone overlap, and engagement structure.
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-[#0A0F1A] mb-1">Full Name *</label>
          <input
            required
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-[#0A192F] focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-[#0A0F1A] mb-1">Work Email *</label>
          <input
            required
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-[#0A192F] focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-[#0A0F1A] mb-1">Company Name</label>
          <input
            type="text"
            value={form.company}
            onChange={(e) => setForm({ ...form, company: e.target.value })}
            className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-[#0A192F] focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-[#0A0F1A] mb-1">Phone / WhatsApp</label>
          <input
            type="text"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-[#0A192F] focus:outline-none"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-semibold text-[#0A0F1A] mb-1">Primary Domain</label>
          <select
            value={form.domain}
            onChange={(e) => setForm({ ...form, domain: e.target.value })}
            className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:border-[#0A192F] focus:outline-none"
          >
            <option>Software Engineering</option>
            <option>DevOps &amp; Cloud</option>
            <option>AI &amp; Machine Learning</option>
            <option>Cybersecurity</option>
            <option>Data Science &amp; Analytics</option>
            <option>Data Operations &amp; Data Entry</option>
            <option>Mainframe, COBOL &amp; PL/I</option>
            <option>AS/400, Pick &amp; MultiValue</option>
            <option>Infrastructure &amp; Network</option>
            <option>Logistics &amp; Supply Chain</option>
            <option>Accounting &amp; Finance</option>
            <option>Project &amp; Operations Management</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-[#0A0F1A] mb-1">Engagement Model</label>
          <select
            value={form.engagementModel}
            onChange={(e) => setForm({ ...form, engagementModel: e.target.value })}
            className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:border-[#0A192F] focus:outline-none"
          >
            <option>Dedicated Full-Time</option>
            <option>Self-Contained Pod (Lead + Devs + QA)</option>
            <option>Fractional / Part-Time Specialist</option>
            <option>Fixed-Scope Delivery</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-[#0A0F1A] mb-1">Headcount Needed</label>
          <input
            type="number"
            min={1}
            max={50}
            value={form.headcount}
            onChange={(e) => setForm({ ...form, headcount: Number(e.target.value) })}
            className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-[#0A192F] focus:outline-none"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-[#0A0F1A] mb-1">Target Role Title(s)</label>
          <input
            type="text"
            value={form.roleNeeded}
            onChange={(e) => setForm({ ...form, roleNeeded: e.target.value })}
            placeholder="e.g. Senior Next.js Engineer, COBOL Analyst, Logistics Manager"
            className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-[#0A192F] focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-[#0A0F1A] mb-1">Required Skills &amp; Stack</label>
          <input
            type="text"
            value={form.skillsText}
            onChange={(e) => setForm({ ...form, skillsText: e.target.value })}
            placeholder="e.g. TypeScript, AWS, CICS, DB2, Xero"
            className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-[#0A192F] focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-[#0A0F1A] mb-1">Start Timeline</label>
          <select
            value={form.timeline}
            onChange={(e) => setForm({ ...form, timeline: e.target.value })}
            className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:border-[#0A192F] focus:outline-none"
          >
            <option>Immediate (1–2 weeks)</option>
            <option>Within 30 days</option>
            <option>Next Quarter</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-[#0A0F1A] mb-1">Timezone Overlap</label>
          <select
            value={form.timezoneOverlap}
            onChange={(e) => setForm({ ...form, timezoneOverlap: e.target.value })}
            className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:border-[#0A192F] focus:outline-none"
          >
            <option>4–8 Hours UK / EU / US Overlap</option>
            <option>Full US Eastern (EST) Overlap</option>
            <option>Full UK / GMT Overlap</option>
            <option>Full Australia (AEST) Overlap</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-[#0A0F1A] mb-1">
          Project Scope &amp; Technical Requirements *
        </label>
        <textarea
          required
          rows={4}
          value={form.message}
          onChange={(e) => setForm({ ...form, message: e.target.value })}
          placeholder="Describe your architecture, team context, deliverables, and compliance needs..."
          className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-[#0A192F] focus:outline-none"
        />
      </div>

      <label className="flex items-center gap-2.5 text-xs text-slate-700 cursor-pointer">
        <input
          type="checkbox"
          checked={form.ndaRequired}
          onChange={(e) => setForm({ ...form, ndaRequired: e.target.checked })}
          className="h-4 w-4 rounded border-slate-300 text-[#0A192F]"
        />
        <span>Initiate this engagement under Via Codos Mutual NDA prior to technical discovery</span>
      </label>

      <button
        type="submit"
        disabled={submitting}
        className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-[#0A192F] px-6 py-3.5 text-sm font-bold text-white hover:bg-[#1E3A8A] disabled:opacity-50 transition"
      >
        {submitting ? "Submitting Request..." : "Submit Staff Augmentation Request"}
        <ArrowRight className="h-4 w-4" />
      </button>
    </form>
  );
}

