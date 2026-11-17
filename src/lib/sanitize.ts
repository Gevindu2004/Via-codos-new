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
    displayName: p.displayName ?? null,
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

