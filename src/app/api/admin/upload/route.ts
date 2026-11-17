import fs from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession, hasAdminRole } from "@/lib/auth";
import { recordAuditLog } from "@/lib/audit";
import { resolveUploadStorageDir, validateAndScanUploadBuffer } from "@/lib/security";

export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasAdminRole(session, ["SUPER_ADMIN", "CONTENT_EDITOR"])) {
    return NextResponse.json({ error: "Insufficient role permissions for uploads." }, { status: 403 });
  }

  try {
    const fd = await req.formData();
    const file = fd.get("file") as File | null;
    const altText = String(fd.get("altText") || "").trim();
    const folder = String(fd.get("folder") || "general").trim();

    if (!file || file.size === 0) {
      return NextResponse.json({ error: "File is required." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const scan = await validateAndScanUploadBuffer(file.name, file.type, buffer, "media");
    if (!scan.ok) {
      return NextResponse.json({ error: scan.error }, { status: 400 });
    }

    // Stored outside executable/public webroot (storage/uploads or UPLOAD_STORAGE_DIR)
    const dir = resolveUploadStorageDir("uploads");
    await fs.mkdir(dir, { recursive: true });
    const filename = scan.safeFilename;
    const absPath = path.join(dir, filename);
    await fs.writeFile(absPath, buffer, { mode: 0o644 });

    const asset = await prisma.mediaAsset.create({
      data: {
        filename,
        originalName: file.name,
        mimeType: scan.mimeType,
        sizeBytes: buffer.length,
        url: `/api/media/${filename}`,
        altText: altText || file.name,
        folder,
        uploadedBy: session.email,
      },
    });

    await recordAuditLog({
      actorId: session.userId,
      actorEmail: session.email,
      actorRole: session.role,
      action: "UPLOAD_MEDIA",
      entityType: "MediaAsset",
      entityId: asset.id,
      entityLabel: asset.originalName,
      summary: `Uploaded media asset ${asset.originalName} (${asset.url})`,
    });

    return NextResponse.json({ asset });
  } catch (err) {
    console.error("Upload error:", err);
    return NextResponse.json({ error: "Failed to upload file." }, { status: 500 });
  }
}

