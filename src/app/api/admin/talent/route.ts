import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth";
import { recordAuditLog } from "@/lib/audit";

export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [profiles, domains] = await Promise.all([
    prisma.talentProfile.findMany({ orderBy: [{ visibilityFlag: "desc" }, { profileCode: "asc" }] }),
    prisma.talentDomain.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);

  const published = profiles.filter((p) => p.status === "PUBLISHED");
  const realCount = published.filter((p) => p.visibilityFlag === "REAL").length;
  const sampleCount = published.filter((p) => p.visibilityFlag === "SAMPLE").length;
  const totalPublished = published.length;
  const realRatioPct = totalPublished > 0 ? Math.round((realCount / totalPublished) * 100) : 0;

  return NextResponse.json({
    profiles,
    domains,
    metrics: { totalPublished, realCount, sampleCount, realRatioPct },
  });
}

export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const saved = body.id
      ? await prisma.talentProfile.update({
          where: { id: body.id },
          data: {
            displayName: body.displayName ?? null,
            category: body.category,
            domainSlug: body.domainSlug,
            domainName: body.domainName,
            roleTitle: body.roleTitle,
            summary: body.summary,
            skillsJson: JSON.stringify(body.skills || []),
            yearsExperience: Number(body.yearsExperience || 0),
            industriesJson: JSON.stringify(body.industries || []),
            availability: body.availability || "IMMEDIATE",
            hourlyRateUsd: Number(body.hourlyRateUsd || 30),
            monthlyRateUsd: Number(body.monthlyRateUsd || 4500),
            visibilityFlag: body.visibilityFlag || "SAMPLE",
            placementStatus: body.placementStatus || "AVAILABLE",
            status: body.status || "PUBLISHED",
          },
        })
      : await prisma.talentProfile.create({
          data: {
            profileCode: body.profileCode,
            displayName: body.displayName ?? null,
            category: body.category || "IT",
            domainSlug: body.domainSlug,
            domainName: body.domainName,
            roleTitle: body.roleTitle,
            summary: body.summary,
            skillsJson: JSON.stringify(body.skills || []),
            yearsExperience: Number(body.yearsExperience || 0),
            projectsJson: JSON.stringify(body.projects || []),
            industriesJson: JSON.stringify(body.industries || []),
            availability: body.availability || "IMMEDIATE",
            hourlyRateUsd: Number(body.hourlyRateUsd || 30),
            monthlyRateUsd: Number(body.monthlyRateUsd || 4500),
            visibilityFlag: body.visibilityFlag || "REAL",
            placementStatus: "AVAILABLE",
            status: body.status || "PUBLISHED",
          },
        });

    await recordAuditLog({
      actorId: session.userId,
      actorEmail: session.email,
      actorRole: session.role,
      action: body.id ? "UPDATE" : "CREATE",
      entityType: "TalentProfile",
      entityId: saved.id,
      entityLabel: saved.profileCode,
      summary: `${body.id ? "Updated" : "Created"} talent profile ${saved.profileCode} (${saved.visibilityFlag})`,
    });

    return NextResponse.json({ profile: saved });
  } catch (err) {
    console.error("Admin talent error:", err);
    return NextResponse.json({ error: "Failed to save talent profile." }, { status: 500 });
  }
}

