import fs from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";
import { resolveUploadStorageDir } from "@/lib/security";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Admin authorization required." }, { status: 401 });
  }
  const { filename } = await params;
  const safeName = path.basename(filename);
  const absPath = path.join(resolveUploadStorageDir("cvs"), safeName);
  try {
    const buf = await fs.readFile(absPath);
    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${safeName}"`,
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
        "Cache-Control": "no-store, private",
      },
    });
  } catch {
    return NextResponse.json({ error: "CV file not found." }, { status: 404 });
  }
}

