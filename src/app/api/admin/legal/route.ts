import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession, hasAdminRole } from "@/lib/auth";
import { recordAuditLog, saveContentVersion } from "@/lib/audit";
import { slugify } from "@/lib/sanitize";
import { dispatchEmail } from "@/lib/email";
import { escapeHtml, sanitizeRichHtml } from "@/lib/security";

const LEGAL_ROLES = ["SUPER_ADMIN", "LEGAL_ADMIN"];

export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasAdminRole(session, LEGAL_ROLES)) {
    return NextResponse.json({ error: "Forbidden: insufficient permissions." }, { status: 403 });
  }

  const [types, documents, signatureRequests] = await Promise.all([
    prisma.legalDocumentType.findMany({ orderBy: { name: "asc" } }),
    prisma.legalDocument.findMany({ include: { type: true }, orderBy: { updatedAt: "desc" } }),
    prisma.signatureRequest.findMany({ orderBy: { createdAt: "desc" }, take: 50 }),
  ]);

  return NextResponse.json({ types, documents, signatureRequests });
}

export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasAdminRole(session, LEGAL_ROLES)) {
    return NextResponse.json({ error: "Forbidden: insufficient permissions." }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { action } = body;

    // Create unlimited new legal document types
    if (action === "CREATE_TYPE") {
      const slug = slugify(body.slug || body.name);
      const created = await prisma.legalDocumentType.create({
        data: {
          slug,
          name: body.name,
          description: body.description || null,
          isPublicPolicy: Boolean(body.isPublicPolicy),
          isPrivateTemplate: Boolean(body.isPrivateTemplate),
        },
      });
      await recordAuditLog({
        actorId: session.userId,
        actorEmail: session.email,
        actorRole: session.role,
        action: "CREATE",
        entityType: "LegalDocumentType",
        entityId: created.id,
        entityLabel: created.name,
        summary: `Created new legal document type "${created.name}"`,
      });
      return NextResponse.json({ type: created });
    }

    // Create or update Legal Document (with version, effectiveDate, public/template flags, version history)
    if (action === "SAVE_DOC") {
      const slug = slugify(body.slug || body.title);
      const saved = body.id
        ? await prisma.legalDocument.update({
            where: { id: body.id },
            data: {
              typeId: body.typeId,
              slug,
              title: body.title,
              version: body.version || "1.0",
              effectiveDate: new Date(body.effectiveDate || Date.now()),
              summary: body.summary || null,
              contentHtml: body.contentHtml,
              status: body.status || "PUBLISHED",
              isPublic: Boolean(body.isPublic),
              isTemplate: Boolean(body.isTemplate),
              updatedBy: session.email,
            },
          })
        : await prisma.legalDocument.create({
            data: {
              typeId: body.typeId,
              slug,
              title: body.title,
              version: body.version || "1.0",
              effectiveDate: new Date(body.effectiveDate || Date.now()),
              summary: body.summary || null,
              contentHtml: body.contentHtml,
              status: body.status || "PUBLISHED",
              isPublic: Boolean(body.isPublic),
              isTemplate: Boolean(body.isTemplate),
              updatedBy: session.email,
            },
          });

      await saveContentVersion({
        entityType: "LegalDocument",
        entityId: saved.id,
        snapshot: saved,
        changeNote: `Legal v${saved.version} (${saved.status})`,
        createdByEmail: session.email,
      });

      await recordAuditLog({
        actorId: session.userId,
        actorEmail: session.email,
        actorRole: session.role,
        action: body.id ? "UPDATE" : "CREATE",
        entityType: "LegalDocument",
        entityId: saved.id,
        entityLabel: saved.title,
        summary: `${body.id ? "Updated" : "Created"} legal document "${saved.title}" v${saved.version}`,
      });

      return NextResponse.json({ document: saved });
    }

    // Generate Client E-Sign Link from any Legal Document / Template
    if (action === "GENERATE_SIGN_LINK") {
      const doc = await prisma.legalDocument.findUnique({ where: { id: body.documentId } });
      if (!doc) return NextResponse.json({ error: "Document not found." }, { status: 404 });

      const effectiveDate = new Date().toISOString().slice(0, 10);
      const renderedHtml = sanitizeRichHtml(
        doc.contentHtml
          .replace(/\{\{effectiveDate\}\}/g, escapeHtml(effectiveDate))
          .replace(/\{\{clientName\}\}/g, escapeHtml(body.clientName))
          .replace(/\{\{clientEmail\}\}/g, escapeHtml(body.clientEmail))
          .replace(/\{\{clientCompany\}\}/g, escapeHtml(body.clientCompany || body.clientName))
          .replace(/\{\{profileCode\}\}/g, escapeHtml(body.profileCode || "N/A"))
          .replace(/\{\{roleTitle\}\}/g, escapeHtml(body.roleTitle || "Agreed Services"))
          .replace(/\{\{monthlyRateUsd\}\}/g, escapeHtml(body.monthlyRateUsd || "Agreed"))
      );

      const token = `sign-${crypto.randomBytes(10).toString("hex")}`;
      const sigReq = await prisma.signatureRequest.create({
        data: {
          token,
          documentId: doc.id,
          documentTitle: doc.title,
          documentVersion: doc.version,
          renderedHtml,
          clientName: body.clientName,
          clientEmail: body.clientEmail,
          clientCompany: body.clientCompany || null,
          createdBy: session.email,
        },
      });

      const signUrl = `/sign/${token}`;

      await dispatchEmail({
        toEmail: body.clientEmail,
        subject: `Signature Requested: ${doc.title} — Via Codos`,
        bodyText: `Dear ${body.clientName},\n\nPlease review and electronically sign "${doc.title}" (v${doc.version}) at:\n${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}${signUrl}\n\nRegards,\nVia Codos Legal`,
        relatedEntity: `SignatureRequest:${sigReq.id}`,
      });

      await recordAuditLog({
        actorId: session.userId,
        actorEmail: session.email,
        actorRole: session.role,
        action: "GENERATE_SIGN_LINK",
        entityType: "SignatureRequest",
        entityId: sigReq.id,
        entityLabel: `${doc.title} -> ${body.clientEmail}`,
        summary: `Generated e-sign link for "${doc.title}" sent to ${body.clientEmail}`,
      });

      return NextResponse.json({ signatureRequest: sigReq, signUrl });
    }

    return NextResponse.json({ error: "Invalid legal action." }, { status: 400 });
  } catch (err) {
    console.error("Admin legal error:", err);
    return NextResponse.json({ error: "Legal operation failed." }, { status: 500 });
  }
}

