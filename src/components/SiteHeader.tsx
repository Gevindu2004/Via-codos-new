"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, ChevronDown } from "lucide-react";
import { ViaCodosLogo } from "./ViaCodosLogo";

export interface NavMenuItem {
  id: string;
  label: string;
  href: string;
  openInNewTab?: boolean;
}

interface SiteHeaderProps {
  menuItems: NavMenuItem[];
  consoleUrl?: string;
}

export function SiteHeader({ menuItems, consoleUrl = "/codos-console" }: SiteHeaderProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur-md">
      {/* Main Corporate Navigation */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between gap-3">
        <Link href="/" className="shrink-0" aria-label="Via Codos Home">
          <ViaCodosLogo size={30} />
        </Link>

        {/* Desktop Links */}
        <nav className="hidden lg:flex items-center gap-0.5" aria-label="Primary Navigation">
          {menuItems.map((item) => {
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname?.startsWith(item.href);
            return (
              <Link
                key={item.id}
                href={item.href}
                target={item.openInNewTab ? "_blank" : undefined}
                className={`whitespace-nowrap px-1.5 xl:px-2 py-1.5 rounded-lg text-[12px] xl:text-[12.5px] 2xl:text-[13px] font-medium transition ${
                  active
                    ? "bg-[#0A192F]/5 text-[#0A192F] font-semibold"
                    : "text-slate-700 hover:text-[#0A192F] hover:bg-slate-50"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Right Actions */}
        <div className="hidden lg:flex items-center gap-2 shrink-0 whitespace-nowrap">
          <Link
            href="/portal"
            className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-semibold text-[#0A0F1A] hover:border-[#0A192F] transition"
          >
            Client Login
          </Link>
          <Link
            href="/staff-augmentation/request"
            className="rounded-full bg-[#0A192F] px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-[#1E3A8A] transition"
          >
            Request Engineers
          </Link>
        </div>

        {/* Mobile Toggle */}
        <button
          type="button"
          onClick={() => setMobileOpen(!mobileOpen)}
          className="lg:hidden rounded-lg border border-slate-200 p-2 text-[#0A192F]"
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="lg:hidden border-t border-slate-200 bg-white px-4 py-4 space-y-1">
          {menuItems.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className="flex items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium text-slate-800 hover:bg-slate-50"
            >
              <span>{item.label}</span>
              <ChevronDown className="h-4 w-4 -rotate-90 text-slate-400" />
            </Link>
          ))}
          <div className="pt-3 border-t border-slate-200 grid grid-cols-2 gap-2">
            <Link
              href="/portal"
              onClick={() => setMobileOpen(false)}
              className="text-center rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-[#0A0F1A]"
            >
              Client Portal
            </Link>
            <Link
              href="/staff-augmentation/request"
              onClick={() => setMobileOpen(false)}
              className="text-center rounded-lg bg-[#0A192F] px-3 py-2 text-xs font-semibold text-white"
            >
              Request Engineers
            </Link>
            <Link
              href={consoleUrl}
              onClick={() => setMobileOpen(false)}
              className="col-span-2 text-center rounded-lg bg-slate-100 px-3 py-2 text-xs font-semibold text-[#1D4ED8]"
            >
              Launch Codos Console →
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}

