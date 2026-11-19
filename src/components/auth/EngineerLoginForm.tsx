"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Code2, Lock, Mail } from "lucide-react";

export function EngineerLoginForm() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/engineer/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Sign in failed.");
        return;
      }
      router.push("/engineer");
      router.refresh();
    } catch {
      setError("Network error while signing in.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[75vh] bg-[#F8FAFC] flex items-center justify-center py-12 px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-xl space-y-6">
        <div className="space-y-2 text-center">
          <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-xl bg-[#0A192F] text-sky-300 shadow">
            <Code2 className="h-6 w-6" />
          </div>
          <div className="text-[11px] font-bold uppercase tracking-widest text-[#1D4ED8]">
            Via Codos Talent Workspace
          </div>
          <h1 className="font-heading text-2xl font-extrabold text-[#0A0F1A]">
            Engineer Portal Login
          </h1>
          <p className="text-xs text-slate-500">
            Access your assigned engineering tasks, live AI interviews, and client communication workspace.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#0A0F1A] mb-1.5">
              Staff Profile ID or Email
            </label>
            <div className="relative">
              <Mail className="h-4 w-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="VC-IT-102 or engineer.vc102@viacodos.com"
                className="w-full rounded-xl border border-slate-300 pl-10 pr-4 py-2.5 text-sm focus:border-[#0A192F] focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#0A0F1A] mb-1.5">
              Password
            </label>
            <div className="relative">
              <Lock className="h-4 w-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your engineer password"
                className="w-full rounded-xl border border-slate-300 pl-10 pr-4 py-2.5 text-sm focus:border-[#0A192F] focus:outline-none"
              />
            </div>
          </div>

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-[#0A192F] px-6 py-3 text-sm font-bold text-white shadow-sm hover:bg-[#1E3A8A] transition disabled:opacity-50"
          >
            {loading ? "Signing in..." : "Sign In to Engineer Portal"}
            <ArrowRight className="h-4 w-4" />
          </button>
        </form>

        <div className="rounded-xl border border-slate-200 bg-[#F8FAFC] p-3.5 text-[11px] text-slate-600 space-y-1">
          <div className="font-bold text-[#0A192F]">Looking for another portal?</div>
          <div className="flex items-center gap-4">
            <Link href="/portal/login" className="text-[#1D4ED8] font-semibold hover:underline">
              Client Portal →
            </Link>
            <Link href="/admin/login" className="text-slate-600 hover:underline">
              Admin Console →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

