import React from "react";
import { prisma } from "@/lib/prisma";
import { safeJsonParse } from "@/lib/sanitize";
import { getAdminSession, getClientSession, getEngineerSession } from "@/lib/auth";
import { SiteHeader } from "./SiteHeader";
import { SiteFooter } from "./SiteFooter";
import { BackToTopButton } from "./ScrollAnimator";

export async function getSiteChromeData() {
  const [menus, brandSetting, clientSession, adminSession, engineerSession] = await Promise.all([
    prisma.menuItem.findMany({
      where: { isVisible: true },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.siteSetting.findUnique({ where: { key: "brand" } }),
    getClientSession(),
    getAdminSession(),
    getEngineerSession(),
  ]);

  const brand = safeJsonParse<Record<string, string>>(brandSetting?.valueJson, {});
  const loggedInUser = clientSession
    ? { name: clientSession.name, href: "/portal", kind: "client" as const }
    : engineerSession
      ? { name: engineerSession.profileCode, href: "/engineer", kind: "engineer" as const }
      : adminSession
        ? { name: adminSession.name, href: "/admin", kind: "admin" as const }
        : null;

  return {
    headerMenus: menus.filter((m) => m.location === "HEADER"),
    footerCompany: menus.filter((m) => m.location === "FOOTER_COMPANY"),
    footerResources: menus.filter((m) => m.location === "FOOTER_RESOURCES"),
    footerLegal: menus.filter((m) => m.location === "FOOTER_LEGAL"),
    brand,
    loggedInUser,
  };
}

export async function PublicShell({ children }: { children: React.ReactNode }) {
  const chrome = await getSiteChromeData();

  return (
    <div className="min-h-screen flex flex-col bg-white text-[#0A0F1A]">
      <SiteHeader
        menuItems={chrome.headerMenus}
        consoleUrl={chrome.brand.codosConsoleUrl || "/codos-console"}
        loggedInUser={chrome.loggedInUser}
      />
      <main className="flex-1">{children}</main>
      <SiteFooter
        companyLinks={chrome.footerCompany}
        resourceLinks={chrome.footerResources}
        legalLinks={chrome.footerLegal}
        brand={chrome.brand}
      />
      <BackToTopButton />
    </div>
  );
}

