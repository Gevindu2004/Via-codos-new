import React from "react";
import { prisma } from "@/lib/prisma";
import { safeJsonParse } from "@/lib/sanitize";
import { SiteHeader } from "./SiteHeader";
import { SiteFooter } from "./SiteFooter";
import { BackToTopButton } from "./ScrollAnimator";

export async function getSiteChromeData() {
  const [menus, brandSetting] = await Promise.all([
    prisma.menuItem.findMany({
      where: { isVisible: true },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.siteSetting.findUnique({ where: { key: "brand" } }),
  ]);

  const brand = safeJsonParse<Record<string, string>>(brandSetting?.valueJson, {});

  return {
    headerMenus: menus.filter((m) => m.location === "HEADER"),
    footerCompany: menus.filter((m) => m.location === "FOOTER_COMPANY"),
    footerResources: menus.filter((m) => m.location === "FOOTER_RESOURCES"),
    footerLegal: menus.filter((m) => m.location === "FOOTER_LEGAL"),
    brand,
  };
}

export async function PublicShell({ children }: { children: React.ReactNode }) {
  const chrome = await getSiteChromeData();

  return (
    <div className="min-h-screen flex flex-col bg-white text-[#0A0F1A]">
      <SiteHeader
        menuItems={chrome.headerMenus}
        consoleUrl={chrome.brand.codosConsoleUrl || "/codos-console"}
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

