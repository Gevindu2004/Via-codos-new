import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth";
import { recordAuditLog, saveContentVersion } from "@/lib/audit";
import { slugify } from "@/lib/sanitize";

export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [
    pages,
    categories,
    menus,
    settings,
    services,
    industries,
    caseStudies,
    insights,
    saasProducts,
    media,
  ] = await Promise.all([
    prisma.cmsPage.findMany({
      include: { category: true, sections: { orderBy: { sortOrder: "asc" } } },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.category.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.menuItem.findMany({ orderBy: [{ location: "asc" }, { sortOrder: "asc" }] }),
    prisma.siteSetting.findMany(),
    prisma.service.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.industry.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.caseStudy.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.insightArticle.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.saasProduct.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.mediaAsset.findMany({ orderBy: { createdAt: "desc" } }),
  ]);

  return NextResponse.json({
    pages,
    categories,
    menus,
    settings,
    services,
    industries,
    caseStudies,
    insights,
    saasProducts,
    media,
  });
}

export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { entity, action, payload } = body;

    // 1. CATEGORIES
    if (entity === "Category") {
      if (action === "DELETE") {
        await prisma.category.delete({ where: { id: payload.id } });
        await recordAuditLog({
          actorId: session.userId,
          actorEmail: session.email,
          actorRole: session.role,
          action: "DELETE",
          entityType: "Category",
          entityId: payload.id,
          entityLabel: payload.name || payload.id,
          summary: `Deleted category ${payload.name || payload.id}`,
        });
        return NextResponse.json({ ok: true });
      }
      const slug = slugify(payload.slug || payload.name);
      const saved = payload.id
        ? await prisma.category.update({
            where: { id: payload.id },
            data: { name: payload.name, slug, scope: payload.scope || "PAGE", description: payload.description || null },
          })
        : await prisma.category.create({
            data: { name: payload.name, slug, scope: payload.scope || "PAGE", description: payload.description || null },
          });
      await recordAuditLog({
        actorId: session.userId,
        actorEmail: session.email,
        actorRole: session.role,
        action: payload.id ? "UPDATE" : "CREATE",
        entityType: "Category",
        entityId: saved.id,
        entityLabel: saved.name,
        summary: `${payload.id ? "Updated" : "Created"} category ${saved.name}`,
      });
      return NextResponse.json({ item: saved });
    }

    // 2. MENUS & FOOTER
    if (entity === "MenuItem") {
      if (action === "DELETE") {
        await prisma.menuItem.delete({ where: { id: payload.id } });
        await recordAuditLog({
          actorId: session.userId,
          actorEmail: session.email,
          actorRole: session.role,
          action: "DELETE",
          entityType: "MenuItem",
          entityId: payload.id,
          entityLabel: payload.label || payload.id,
          summary: `Removed menu item ${payload.label || payload.id}`,
        });
        return NextResponse.json({ ok: true });
      }
      const saved = payload.id
        ? await prisma.menuItem.update({
            where: { id: payload.id },
            data: {
              location: payload.location,
              label: payload.label,
              href: payload.href,
              sortOrder: Number(payload.sortOrder || 0),
              isVisible: Boolean(payload.isVisible ?? true),
            },
          })
        : await prisma.menuItem.create({
            data: {
              location: payload.location || "HEADER",
              label: payload.label,
              href: payload.href,
              sortOrder: Number(payload.sortOrder || 0),
              isVisible: Boolean(payload.isVisible ?? true),
            },
          });
      await recordAuditLog({
        actorId: session.userId,
        actorEmail: session.email,
        actorRole: session.role,
        action: payload.id ? "UPDATE" : "CREATE",
        entityType: "MenuItem",
        entityId: saved.id,
        entityLabel: saved.label,
        summary: `${payload.id ? "Updated" : "Created"} navigation link "${saved.label}" -> ${saved.href}`,
      });
      return NextResponse.json({ item: saved });
    }

    // 3. SITE SETTINGS
    if (entity === "SiteSetting") {
      const saved = await prisma.siteSetting.upsert({
        where: { key: payload.key },
        update: { valueJson: JSON.stringify(payload.value) },
        create: { key: payload.key, valueJson: JSON.stringify(payload.value) },
      });
      await recordAuditLog({
        actorId: session.userId,
        actorEmail: session.email,
        actorRole: session.role,
        action: "UPDATE",
        entityType: "SiteSetting",
        entityId: saved.key,
        entityLabel: saved.key,
        summary: `Updated site setting "${saved.key}"`,
      });
      return NextResponse.json({ item: saved });
    }

    // 4. CMS PAGES & SECTIONS (No-code Page Builder)
    if (entity === "CmsPage") {
      if (action === "DELETE") {
        await prisma.cmsPage.delete({ where: { id: payload.id } });
        await recordAuditLog({
          actorId: session.userId,
          actorEmail: session.email,
          actorRole: session.role,
          action: "DELETE",
          entityType: "CmsPage",
          entityId: payload.id,
          entityLabel: payload.title || payload.id,
          summary: `Deleted CMS page ${payload.title || payload.id}`,
        });
        return NextResponse.json({ ok: true });
      }
      const slug = slugify(payload.slug || payload.title);
      const saved = payload.id
        ? await prisma.cmsPage.update({
            where: { id: payload.id },
            data: {
              slug,
              title: payload.title,
              subtitle: payload.subtitle || null,
              categoryId: payload.categoryId || null,
              status: payload.status || "DRAFT",
              publishedAt: payload.status === "PUBLISHED" ? new Date() : null,
              updatedBy: session.email,
            },
          })
        : await prisma.cmsPage.create({
            data: {
              slug,
              title: payload.title,
              subtitle: payload.subtitle || null,
              categoryId: payload.categoryId || null,
              status: payload.status || "PUBLISHED",
              publishedAt: payload.status !== "DRAFT" ? new Date() : null,
              updatedBy: session.email,
            },
          });

      await saveContentVersion({
        entityType: "CmsPage",
        entityId: saved.id,
        snapshot: saved,
        changeNote: payload.changeNote || `Saved page (${saved.status})`,
        createdByEmail: session.email,
      });
      await recordAuditLog({
        actorId: session.userId,
        actorEmail: session.email,
        actorRole: session.role,
        action: payload.id ? "UPDATE" : "CREATE",
        entityType: "CmsPage",
        entityId: saved.id,
        entityLabel: saved.title,
        summary: `${payload.id ? "Updated" : "Created"} page /p/${saved.slug} (${saved.status})`,
      });
      return NextResponse.json({ item: saved });
    }

    if (entity === "CmsSection") {
      if (action === "DELETE") {
        await prisma.cmsSection.delete({ where: { id: payload.id } });
        return NextResponse.json({ ok: true });
      }
      const saved = payload.id
        ? await prisma.cmsSection.update({
            where: { id: payload.id },
            data: {
              type: payload.type || "RICH_TEXT",
              title: payload.title || null,
              subtitle: payload.subtitle || null,
              bodyHtml: payload.bodyHtml || null,
              imageUrl: payload.imageUrl || null,
              dataJson: payload.dataJson || null,
              sortOrder: Number(payload.sortOrder || 0),
              isVisible: Boolean(payload.isVisible ?? true),
            },
          })
        : await prisma.cmsSection.create({
            data: {
              pageId: payload.pageId,
              sectionKey: slugify(payload.title || "section") + "-" + Date.now(),
              type: payload.type || "RICH_TEXT",
              title: payload.title || null,
              subtitle: payload.subtitle || null,
              bodyHtml: payload.bodyHtml || null,
              imageUrl: payload.imageUrl || null,
              dataJson: payload.dataJson || null,
              sortOrder: Number(payload.sortOrder || 1),
            },
          });
      await recordAuditLog({
        actorId: session.userId,
        actorEmail: session.email,
        actorRole: session.role,
        action: payload.id ? "UPDATE" : "CREATE",
        entityType: "CmsSection",
        entityId: saved.id,
        entityLabel: saved.title || saved.type,
        summary: `${payload.id ? "Updated" : "Added"} ${saved.type} section on page`,
      });
      return NextResponse.json({ item: saved });
    }

    // 5. SERVICES
    if (entity === "Service") {
      const saved = await prisma.service.update({
        where: { id: payload.id },
        data: {
          name: payload.name,
          tagline: payload.tagline,
          oneliner: payload.oneliner,
          bodyJson: JSON.stringify(payload.body || []),
          includedJson: JSON.stringify(payload.included || []),
          statValue: payload.statValue,
          statLabel: payload.statLabel,
          status: payload.status || "PUBLISHED",
        },
      });
      await saveContentVersion({
        entityType: "Service",
        entityId: saved.id,
        snapshot: saved,
        changeNote: payload.changeNote || `Updated service (${saved.status})`,
        createdByEmail: session.email,
      });
      await recordAuditLog({
        actorId: session.userId,
        actorEmail: session.email,
        actorRole: session.role,
        action: "UPDATE",
        entityType: "Service",
        entityId: saved.id,
        entityLabel: saved.name,
        summary: `Updated service "${saved.name}" (${saved.status})`,
      });
      return NextResponse.json({ item: saved });
    }

    // 6. INDUSTRIES
    if (entity === "Industry") {
      const saved = await prisma.industry.update({
        where: { id: payload.id },
        data: {
          name: payload.name,
          intro: payload.intro,
          challengesJson: JSON.stringify(payload.challenges || []),
          solutionsJson: JSON.stringify(payload.solutions || []),
          status: payload.status || "PUBLISHED",
        },
      });
      await saveContentVersion({
        entityType: "Industry",
        entityId: saved.id,
        snapshot: saved,
        changeNote: payload.changeNote || "Updated industry",
        createdByEmail: session.email,
      });
      await recordAuditLog({
        actorId: session.userId,
        actorEmail: session.email,
        actorRole: session.role,
        action: "UPDATE",
        entityType: "Industry",
        entityId: saved.id,
        entityLabel: saved.name,
        summary: `Updated industry "${saved.name}" (${saved.status})`,
      });
      return NextResponse.json({ item: saved });
    }

    // 7. CASE STUDIES / PORTFOLIO
    if (entity === "CaseStudy") {
      const saved = await prisma.caseStudy.update({
        where: { id: payload.id },
        data: {
          name: payload.name,
          sector: payload.sector,
          headline: payload.headline,
          clientDesc: payload.clientDesc,
          challenge: payload.challenge,
          solution: payload.solution,
          quote: payload.quote,
          imageUrl: payload.imageUrl,
          status: payload.status || "PUBLISHED",
        },
      });
      await saveContentVersion({
        entityType: "CaseStudy",
        entityId: saved.id,
        snapshot: saved,
        changeNote: payload.changeNote || "Updated case study",
        createdByEmail: session.email,
      });
      await recordAuditLog({
        actorId: session.userId,
        actorEmail: session.email,
        actorRole: session.role,
        action: "UPDATE",
        entityType: "CaseStudy",
        entityId: saved.id,
        entityLabel: saved.name,
        summary: `Updated portfolio project "${saved.name}" (${saved.status})`,
      });
      return NextResponse.json({ item: saved });
    }

    // 8. INSIGHTS / BLOG
    if (entity === "InsightArticle") {
      const slug = slugify(payload.slug || payload.title);
      const saved = payload.id
        ? await prisma.insightArticle.update({
            where: { id: payload.id },
            data: {
              title: payload.title,
              category: payload.category,
              dateLabel: payload.dateLabel,
              readTime: payload.readTime,
              excerpt: payload.excerpt,
              bodyHtml: payload.bodyHtml,
              status: payload.status || "PUBLISHED",
            },
          })
        : await prisma.insightArticle.create({
            data: {
              slug,
              title: payload.title,
              category: payload.category || "Technology",
              dateLabel: payload.dateLabel || "2026",
              readTime: payload.readTime || "5 min read",
              excerpt: payload.excerpt,
              bodyHtml: payload.bodyHtml,
              status: payload.status || "DRAFT",
            },
          });
      await saveContentVersion({
        entityType: "InsightArticle",
        entityId: saved.id,
        snapshot: saved,
        changeNote: payload.changeNote || "Saved insight article",
        createdByEmail: session.email,
      });
      await recordAuditLog({
        actorId: session.userId,
        actorEmail: session.email,
        actorRole: session.role,
        action: payload.id ? "UPDATE" : "CREATE",
        entityType: "InsightArticle",
        entityId: saved.id,
        entityLabel: saved.title,
        summary: `${payload.id ? "Updated" : "Created"} insight "${saved.title}" (${saved.status})`,
      });
      return NextResponse.json({ item: saved });
    }

    // 9. SAAS PRODUCTS
    if (entity === "SaasProduct") {
      const saved = await prisma.saasProduct.update({
        where: { id: payload.id },
        data: {
          name: payload.name,
          tagline: payload.tagline,
          badge: payload.badge,
          summary: payload.summary,
          descriptionHtml: payload.descriptionHtml,
          consolePath: payload.consolePath,
          externalConsoleUrl: payload.externalConsoleUrl || null,
          heroImage: payload.heroImage || null,
          status: payload.status || "PUBLISHED",
        },
      });
      await saveContentVersion({
        entityType: "SaasProduct",
        entityId: saved.id,
        snapshot: saved,
        changeNote: payload.changeNote || "Updated SaaS product",
        createdByEmail: session.email,
      });
      await recordAuditLog({
        actorId: session.userId,
        actorEmail: session.email,
        actorRole: session.role,
        action: "UPDATE",
        entityType: "SaasProduct",
        entityId: saved.id,
        entityLabel: saved.name,
        summary: `Updated SaaS product "${saved.name}" (${saved.status})`,
      });
      return NextResponse.json({ item: saved });
    }

    return NextResponse.json({ error: "Unknown entity type." }, { status: 400 });
  } catch (err) {
    console.error("Admin content error:", err);
    return NextResponse.json({ error: "Failed to save content." }, { status: 500 });
  }
}

