import type { TalentProfile } from "@prisma/client";

export function safeJsonParse<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export interface PublicTalentProfile {
  id: string;
  profileCode: string;
  displayName: string | null;
  category: string;
  domainSlug: string;
  domainName: string;
  roleTitle: string;
  summary: string;
  skills: string[];
  yearsExperience: number;
  projects: Array<{
    title: string;
    scope: string;
    outcome: string;
    stack?: string[];
  }>;
  industries: string[];
  availability: string;
  hourlyRateUsd: number;
  monthlyRateUsd: number;
  visibilityFlag: string;
  placementStatus: string;
}

/**
 * Strips any internal/private candidate linkage and exposes only anonymized
 * engineering/management attributes under the public Profile ID.
 */
export function anonymizeTalentProfile(p: TalentProfile): PublicTalentProfile {
  return {
    id: p.id,
    profileCode: p.profileCode,
    displayName: null,
    category: p.category,
    domainSlug: p.domainSlug,
    domainName: p.domainName,
    roleTitle: p.roleTitle,
    summary: p.summary,
    skills: safeJsonParse<string[]>(p.skillsJson, []),
    yearsExperience: p.yearsExperience,
    projects: safeJsonParse<PublicTalentProfile["projects"]>(p.projectsJson, []),
    industries: safeJsonParse<string[]>(p.industriesJson, []),
    availability: p.availability,
    hourlyRateUsd: p.hourlyRateUsd,
    monthlyRateUsd: p.monthlyRateUsd,
    visibilityFlag: p.visibilityFlag,
    placementStatus: p.placementStatus,
  };
}

/**
 * Browser- and server-safe rich HTML sanitizer for stored/rendered CMS & contract HTML.
 * Strips active tags, inline event handlers, and dangerous URI schemes.
 */
export function sanitizeRichHtml(html: string | null | undefined): string {
  return String(html ?? "")
    .replace(/<\s*(script|iframe|object|embed|form|meta|link|base)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, "")
    .replace(/<\s*(script|iframe|object|embed|form|meta|link|base)[^>]*\/?\s*>/gi, "")
    .replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/(href|src)\s*=\s*(["'])\s*(?:javascript:|vbscript:|data:text\/html)/gi, "$1=$2#blocked-");
}

