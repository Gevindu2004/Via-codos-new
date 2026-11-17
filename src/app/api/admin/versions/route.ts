import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession, hasAdminRole } from "@/lib/auth";
import { recordAuditLog, saveContentVersion } from "@/lib/audit";

export async function GET(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasAdminRole(session, ["SUPER_ADMIN", "CONTENT_EDITOR", "LEGAL_ADMIN"])) {
    return NextResponse.json({ error: "Insufficient role permissions." }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const entityType = searchParams.get("entityType");
  const entityId = searchParams.get("entityId");

  const versions = await prisma.contentVersion.findMany({
    where: {
      ...(entityType ? { entityType } : {}),
      ...(entityId ? { entityId } : {}),
    },
    orderBy: [{ createdAt: "desc" }],
    take: 50,
  });

  return NextResponse.json({ versions });
}

export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasAdminRole(session, ["SUPER_ADMIN", "CONTENT_EDITOR", "LEGAL_ADMIN"])) {
    return NextResponse.json({ error: "Insufficient role permissions for rollback." }, { status: 403 });
  }

  try {
    const { versionId } = await req.json();
    const version = await prisma.contentVersion.findUnique({ where: { id: String(versionId) } });
    if (!version) {
      return NextResponse.json({ error: "Version not found." }, { status: 404 });
    }

    const snap = JSON.parse(version.snapshotJson) as Record<string, unknown>;
    const { entityType, entityId } = version;

    if (entityType === "Service") {
      await prisma.service.update({
        where: { id: entityId },
        data: {
          name: String(snap.name),
          tagline: String(snap.tagline),
          oneliner: String(snap.oneliner),
          bodyJson: String(snap.bodyJson),
          includedJson: String(snap.includedJson),
          statValue: String(snap.statValue),
          statLabel: String(snap.statLabel),
          status: String(snap.status || "PUBLISHED"),
        },
      });
    } else if (entityType === "Industry") {
      await prisma.industry.update({
        where: { id: entityId },
        data: {
          name: String(snap.name),
          intro: String(snap.intro),
          challengesJson: String(snap.challengesJson),
          solutionsJson: String(snap.solutionsJson),
          status: String(snap.status || "PUBLISHED"),
        },
      });
    } else if (entityType === "CaseStudy") {
      await prisma.caseStudy.update({
        where: { id: entityId },
        data: {
          name: String(snap.name),
          headline: String(snap.headline),
          challenge: String(snap.challenge),
          solution: String(snap.solution),
          quote: String(snap.quote),
          status: String(snap.status || "PUBLISHED"),
        },
      });
    } else if (entityType === "InsightArticle") {
      await prisma.insightArticle.update({
        where: { id: entityId },
        data: {
          title: String(snap.title),
          category: String(snap.category),
          excerpt: String(snap.excerpt),
          bodyHtml: String(snap.bodyHtml),
          status: String(snap.status || "PUBLISHED"),
        },
      });
    } else if (entityType === "SaasProduct") {
      await prisma.saasProduct.update({
        where: { id: entityId },
        data: {
          name: String(snap.name),
          tagline: String(snap.tagline),
          summary: String(snap.summary),
          descriptionHtml: String(snap.descriptionHtml),
          consolePath: String(snap.consolePath),
          externalConsoleUrl: snap.externalConsoleUrl ? String(snap.externalConsoleUrl) : null,
          status: String(snap.status || "PUBLISHED"),
        },
      });
    } else if (entityType === "LegalDocument") {
      await prisma.legalDocument.update({
        where: { id: entityId },
        data: {
          title: String(snap.title),
          version: String(snap.version),
          summary: snap.summary ? String(snap.summary) : null,
          contentHtml: String(snap.contentHtml),
          status: String(snap.status || "PUBLISHED"),
          updatedBy: session.email,
        },
      });
    } else if (entityType === "CmsPage") {
      await prisma.cmsPage.update({
        where: { id: entityId },
        data: {
          title: String(snap.title),
          subtitle: snap.subtitle ? String(snap.subtitle) : null,
          status: String(snap.status || "PUBLISHED"),
          updatedBy: session.email,
        },
      });
    }

    await saveContentVersion({
      entityType,
      entityId,
      snapshot: snap,
      changeNote: `Rollback to v${version.versionNumber}`,
      createdByEmail: session.email,
    });

    await recordAuditLog({
      actorId: session.userId,
      actorEmail: session.email,
      actorRole: session.role,
      action: "ROLLBACK",
      entityType,
      entityId,
      entityLabel: `${entityType}:${entityId}`,
      summary: `Rolled back ${entityType} (${entityId}) to version #${version.versionNumber}`,
      after: snap,
    });

    return NextResponse.json({ ok: true, restoredVersion: version.versionNumber });
  } catch (err) {
    console.error("Rollback error:", err);
    return NextResponse.json({ error: "Failed to rollback version." }, { status: 500 });
  }
}

