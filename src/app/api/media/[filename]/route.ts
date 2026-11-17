import fs from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { getSafeImageContentType, resolveUploadStorageDir } from "@/lib/security";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params;
  const safeName = path.basename(filename);
  const contentType = getSafeImageContentType(safeName);
  if (!contentType || safeName !== filename) {
    return NextResponse.json({ error: "Invalid file." }, { status: 400 });
  }

  const absPath = path.join(resolveUploadStorageDir("uploads"), safeName);
  try {
    const buf = await fs.readFile(absPath);
    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return NextResponse.json({ error: "Media file not found." }, { status: 404 });
  }
}

