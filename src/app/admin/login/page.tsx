"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Shield } from "lucide-react";
import { ViaCodosLogo } from "@/components/ViaCodosLogo";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Invalid credentials");
      } else {
        router.push("/admin");
        router.refresh();
      }
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A192F] flex flex-col justify-center py-12 px-4 sm:px-6">
      <div className="mx-auto w-full max-w-md space-y-6">
        <div className="text-center">
          <Link href="/" className="inline-block">
            <ViaCodosLogo dark size={42} />
          </Link>
          <h1 className="font-heading mt-5 text-2xl font-extrabold text-white">
            Via Codos Admin Control Center
          </h1>
          <p className="mt-1 text-xs text-slate-300">
            Protected CMS, Legal &amp; E-Sign Governance, Talent Pipeline &amp; Audit Console
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-white/15 bg-white p-7 shadow-2xl space-y-4"
        >
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-700">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-[#0A0F1A] mb-1">Admin Email</label>
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-[#0A192F] focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#0A0F1A] mb-1">Password</label>
            <input
              required
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-[#0A192F] focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-[#0A192F] py-3 text-sm font-bold text-white hover:bg-[#1E3A8A] disabled:opacity-50"
          >
            <Shield className="h-4 w-4" />
            {loading ? "Authenticating..." : "Sign In to /admin"}
          </button>

          <div className="rounded-xl bg-[#F8FAFC] border border-slate-200 p-3 text-[11px] text-slate-600 space-y-1">
            <div className="font-bold text-[#0A192F]">Administrator Access</div>
            <div>Sign in with the administrator credentials configured in your `.env` setup.</div>
          </div>
        </form>

        <div className="text-center text-xs text-slate-300">
          <Link href="/" className="hover:text-white">
            ← Return to Via Codos Corporate Website
          </Link>
        </div>
      </div>
    </div>
  );
}

