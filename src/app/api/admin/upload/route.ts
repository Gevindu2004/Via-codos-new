import fs from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth";
import { recordAuditLog } from "@/lib/audit";
import { slugify } from "@/lib/sanitize";

export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const fd = await req.formData();
    const file = fd.get("file") as File | null;
    const altText = String(fd.get("altText") || "").trim();
    const folder = String(fd.get("folder") || "general").trim();

    if (!file || file.size === 0) {
      return NextResponse.json({ error: "File is required." }, { status: 400 });
    }

    const dir = path.join(process.cwd(), "public", "uploads");
    await fs.mkdir(dir, { recursive: true });
    const ext = path.extname(file.name).replace(/[^a-zA-Z0-9.]/g, "") || ".png";
    const base = slugify(path.basename(file.name, ext)) || "asset";
    const filename = `${Date.now()}-${base}${ext}`;
    const absPath = path.join(dir, filename);

    const buffer = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(absPath, buffer);

    const asset = await prisma.mediaAsset.create({
      data: {
        filename,
        originalName: file.name,
        mimeType: file.type || "application/octet-stream",
        sizeBytes: file.size,
        url: `/uploads/${filename}`,
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

