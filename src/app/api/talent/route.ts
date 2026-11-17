import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { anonymizeTalentProfile } from "@/lib/sanitize";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category");
  const domain = searchParams.get("domain");
  const skill = searchParams.get("skill")?.toLowerCase().trim();
  const industry = searchParams.get("industry")?.toLowerCase().trim();
  const availability = searchParams.get("availability");
  const minExp = Number(searchParams.get("minExp") || "0");
  const q = searchParams.get("q")?.toLowerCase().trim();

  const where: Record<string, unknown> = { status: "PUBLISHED" };
  if (category && category !== "ALL") where.category = category;
  if (domain && domain !== "ALL") where.domainSlug = domain;
  if (availability && availability !== "ALL") where.availability = availability;
  if (minExp > 0) where.yearsExperience = { gte: minExp };

  const raw = await prisma.talentProfile.findMany({
    where,
    orderBy: [{ visibilityFlag: "asc" }, { profileCode: "asc" }],
  });

  const anonymized = raw.map(anonymizeTalentProfile).filter((p) => {
    if (skill && !p.skills.some((s) => s.toLowerCase().includes(skill))) {
      return false;
    }
    if (industry && !p.industries.some((i) => i.toLowerCase().includes(industry))) {
      return false;
    }
    if (q) {
      const hay = `${p.profileCode} ${p.displayName || ""} ${p.roleTitle} ${p.domainName} ${p.summary} ${p.skills.join(" ")}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  return NextResponse.json({ profiles: anonymized });
}

