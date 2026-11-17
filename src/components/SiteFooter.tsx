import React from "react";
import Link from "next/link";
import { Mail, Phone, MapPin, Terminal } from "lucide-react";
import { ViaCodosLogo } from "./ViaCodosLogo";

interface FooterLink {
  id: string;
  label: string;
  href: string;
  openInNewTab?: boolean;
}

interface SiteFooterProps {
  companyLinks: FooterLink[];
  resourceLinks: FooterLink[];
  legalLinks: FooterLink[];
  brand: {
    companyName?: string;
    tagline?: string;
    address?: string;
    phone?: string;
    email?: string;
    codosConsoleUrl?: string;
  };
}

export function SiteFooter({
  companyLinks,
  resourceLinks,
  legalLinks,
  brand,
}: SiteFooterProps) {
  return (
    <footer className="bg-[#0A0F1A] text-slate-300 border-t border-white/10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10">
          {/* Brand Column */}
          <div className="lg:col-span-2 space-y-5">
            <Link href="/" className="inline-block">
              <ViaCodosLogo dark size={38} />
            </Link>
            <p className="text-sm text-slate-400 max-w-sm leading-relaxed">
              {brand.tagline ||
                "We take care of your IT. So you may focus on your business, with peace of mind."}
            </p>
            <div className="space-y-2.5 text-sm text-slate-300">
              <div className="flex items-center gap-2.5">
                <MapPin className="h-4 w-4 text-sky-400 shrink-0" />
                <span>{brand.address || "Galle, Ginthota, Sri Lanka"}</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Phone className="h-4 w-4 text-sky-400 shrink-0" />
                <a href={`tel:${(brand.phone || "+94769047552").replace(/\s+/g, "")}`} className="hover:text-white">
                  {brand.phone || "+94 76 904 7552"}
                </a>
              </div>
              <div className="flex items-center gap-2.5">
                <Mail className="h-4 w-4 text-sky-400 shrink-0" />
                <a href={`mailto:${brand.email || "info@viacodos.com"}`} className="hover:text-white">
                  {brand.email || "info@viacodos.com"}
                </a>
              </div>
            </div>

            <div className="pt-2">
              <Link
                href={brand.codosConsoleUrl || "/codos-console"}
                className="inline-flex items-center gap-2 rounded-lg border border-sky-400/30 bg-[#0A192F] px-4 py-2 text-xs font-semibold text-sky-300 hover:bg-[#1E3A8A] hover:text-white transition"
              >
                <Terminal className="h-3.5 w-3.5" />
                Switch to Codos Console SaaS →
              </Link>
            </div>
          </div>

          {/* Company */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-white mb-4">Company</h4>
            <ul className="space-y-2.5 text-sm">
              {companyLinks.map((l) => (
                <li key={l.id}>
                  <Link href={l.href} className="text-slate-400 hover:text-white transition">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Ecosystem & SaaS */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-white mb-4">
              Codos Console &amp; SaaS
            </h4>
            <ul className="space-y-2.5 text-sm">
              {resourceLinks.map((l) => (
                <li key={l.id}>
                  <Link href={l.href} className="text-slate-400 hover:text-white transition">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Governance & Legal */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-white mb-4">
              Legal &amp; Governance
            </h4>
            <ul className="space-y-2.5 text-sm">
              {legalLinks.map((l) => (
                <li key={l.id}>
                  <Link href={l.href} className="text-slate-400 hover:text-white transition">
                    {l.label}
                  </Link>
                </li>
              ))}
              <li>
                <Link href="/legal" className="text-sky-400 hover:text-sky-300 transition font-medium">
                  All Legal &amp; Policies →
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <span>© 2026 {brand.companyName || "Via Codos (PVT) LTD"}. All rights reserved.</span>
          <div className="flex items-center gap-5">
            <Link href="/talent" className="hover:text-slate-300">
              Talent Bench
            </Link>
            <Link href="/services" className="hover:text-slate-300">
              Services
            </Link>
            <Link href="/portal" className="hover:text-slate-300">
              Client Portal
            </Link>
            <Link href="/admin" className="hover:text-slate-300">
              Admin CMS
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

