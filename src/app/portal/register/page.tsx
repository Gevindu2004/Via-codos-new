"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2 } from "lucide-react";
import { ViaCodosLogo } from "@/components/ViaCodosLogo";

export default function ClientRegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    companyName: "",
    companyWebsite: "",
    companyCountry: "",
    jobTitle: "",
    phone: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/portal/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Registration failed");
      } else {
        router.push("/portal");
        router.refresh();
      }
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] py-12 px-4 sm:px-6">
      <div className="mx-auto w-full max-w-xl space-y-6">
        <div className="text-center">
          <Link href="/" className="inline-block">
            <ViaCodosLogo size={40} />
          </Link>
          <h1 className="font-heading mt-5 text-2xl font-extrabold text-[#0A0F1A]">
            Client Registration &amp; Company Verification
          </h1>
          <p className="mt-1 text-xs text-slate-600">
            Register your company to request full anonymized talent dossiers, run AI interviews, and sign staff augmentation agreements.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm space-y-4"
        >
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-700">
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
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm focus:border-[#0A192F] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#0A0F1A] mb-1">Job Title</label>
              <input
                type="text"
                value={form.jobTitle}
                onChange={(e) => setForm({ ...form, jobTitle: e.target.value })}
                placeholder="e.g. CTO, VP Engineering"
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm focus:border-[#0A192F] focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#0A0F1A] mb-1">Work Email *</label>
              <input
                required
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm focus:border-[#0A192F] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#0A0F1A] mb-1">Password *</label>
              <input
                required
                minLength={6}
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm focus:border-[#0A192F] focus:outline-none"
              />
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100">
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#1D4ED8] mb-3">
              <Building2 className="h-4 w-4" /> Company Verification Details
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#0A0F1A] mb-1">
                  Legal Company Name *
                </label>
                <input
                  required
                  type="text"
                  value={form.companyName}
                  onChange={(e) => setForm({ ...form, companyName: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm focus:border-[#0A192F] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#0A0F1A] mb-1">
                  Company Website
                </label>
                <input
                  type="text"
                  value={form.companyWebsite}
                  onChange={(e) => setForm({ ...form, companyWebsite: e.target.value })}
                  placeholder="https://company.com"
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm focus:border-[#0A192F] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#0A0F1A] mb-1">Country</label>
                <input
                  type="text"
                  value={form.companyCountry}
                  onChange={(e) => setForm({ ...form, companyCountry: e.target.value })}
                  placeholder="e.g. United Kingdom"
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm focus:border-[#0A192F] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#0A0F1A] mb-1">Phone</label>
                <input
                  type="text"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm focus:border-[#0A192F] focus:outline-none"
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-full bg-[#0A192F] py-3 text-sm font-bold text-white hover:bg-[#1E3A8A] disabled:opacity-50"
          >
            {loading ? "Registering..." : "Create Account & Submit for Verification"}
          </button>
        </form>

        <div className="text-center text-xs text-slate-600">
          Already registered?{" "}
          <Link href="/portal/login" className="font-bold text-[#0A192F] hover:text-[#1D4ED8]">
            Sign in →
          </Link>
        </div>
      </div>
    </div>
  );
}

