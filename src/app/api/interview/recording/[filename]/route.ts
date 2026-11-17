import fs from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params;
  const safeName = path.basename(filename);
  const absPath = path.join(process.cwd(), "storage", "interviews", safeName);
  try {
    const buf = await fs.readFile(absPath);
    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": "video/webm",
        "Accept-Ranges": "bytes",
      },
    });
  } catch {
    return NextResponse.json({ error: "Recording not found." }, { status: 404 });
  }
}

