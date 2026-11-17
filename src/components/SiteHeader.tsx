"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Menu, X, ChevronDown, LogOut, User } from "lucide-react";
import { ViaCodosLogo } from "./ViaCodosLogo";

export interface NavMenuItem {
  id: string;
  label: string;
  href: string;
  openInNewTab?: boolean;
}

export interface HeaderUserInfo {
  name: string;
  href: string;
  kind: "client" | "admin";
}

interface SiteHeaderProps {
  menuItems: NavMenuItem[];
  consoleUrl?: string;
  loggedInUser?: HeaderUserInfo | null;
}

export function SiteHeader({
  menuItems,
  consoleUrl = "/codos-console",
  loggedInUser = null,
}: SiteHeaderProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [logoutModalOpen, setLogoutModalOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  const handleConfirmLogout = async () => {
    if (!loggedInUser) return;
    setLoggingOut(true);
    try {
      const endpoint =
        loggedInUser.kind === "admin"
          ? "/api/admin/auth/logout"
          : "/api/portal/auth/logout";
      await fetch(endpoint, { method: "POST" });
      setLogoutModalOpen(false);
      setMobileOpen(false);
      router.push(loggedInUser.kind === "admin" ? "/admin/login" : "/portal/login");
      router.refresh();
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <>
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
          {loggedInUser ? (
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold">
              <Link
                href={loggedInUser.href}
                title={`Signed in as ${loggedInUser.name}`}
                className="inline-flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[#0A192F] hover:bg-slate-100 transition"
              >
                <User className="h-3.5 w-3.5 text-[#0A192F] shrink-0" />
                <span className="truncate max-w-[120px]">{loggedInUser.name}</span>
              </Link>
              <span className="h-3.5 w-px bg-slate-300" aria-hidden="true" />
              <button
                type="button"
                onClick={() => setLogoutModalOpen(true)}
                className="px-2 py-1.5 rounded-lg text-slate-600 hover:text-red-600 hover:bg-red-50 transition cursor-pointer"
              >
                Logout
              </button>
            </div>
          ) : (
            <Link
              href="/portal"
              className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-semibold text-[#0A0F1A] hover:border-[#0A192F] transition"
            >
              Client Login
            </Link>
          )}
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
            {loggedInUser ? (
              <>
                <Link
                  href={loggedInUser.href}
                  onClick={() => setMobileOpen(false)}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-[#0A192F] truncate"
                >
                  <User className="h-3.5 w-3.5 text-[#0A192F] shrink-0" />
                  <span className="truncate">{loggedInUser.name}</span>
                </Link>
                <button
                  type="button"
                  onClick={() => setLogoutModalOpen(true)}
                  className="text-center rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100"
                >
                  Logout
                </button>
              </>
            ) : (
              <Link
                href="/portal"
                onClick={() => setMobileOpen(false)}
                className="text-center rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-[#0A0F1A]"
              >
                Client Portal
              </Link>
            )}
            <Link
              href="/staff-augmentation/request"
              onClick={() => setMobileOpen(false)}
              className={`text-center rounded-lg bg-[#0A192F] px-3 py-2 text-xs font-semibold text-white ${
                loggedInUser ? "col-span-2" : ""
              }`}
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

      {/* Logout Confirmation Modal */}
      {logoutModalOpen && loggedInUser && (
        <div
          className="fixed inset-0 z-[9998] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-[2px]"
          onClick={() => !loggingOut && setLogoutModalOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="logout-confirm-title"
            className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <LogOut className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />
              <div>
                <h2 id="logout-confirm-title" className="font-heading text-base font-bold text-[#0A0F1A]">
                  Need to logout?
                </h2>
                <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                  Are you sure you want to sign out of <strong>{loggedInUser.name}</strong>?
                </p>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2.5">
              <button
                type="button"
                disabled={loggingOut}
                onClick={() => setLogoutModalOpen(false)}
                className="rounded-full border border-slate-300 bg-white px-5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                No
              </button>
              <button
                type="button"
                disabled={loggingOut}
                onClick={handleConfirmLogout}
                className="rounded-full bg-[#0A192F] px-5 py-2 text-xs font-semibold text-white hover:bg-red-600 transition disabled:opacity-50"
              >
                {loggingOut ? "Logging out..." : "Yes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

