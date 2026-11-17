import fs from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession, getClientSession } from "@/lib/auth";
import { resolveUploadStorageDir } from "@/lib/security";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  const [adminSession, clientSession] = await Promise.all([
    getAdminSession(),
    getClientSession(),
  ]);
  if (!adminSession && !clientSession) {
    return NextResponse.json({ error: "Authorization required." }, { status: 401 });
  }

  const { filename } = await params;
  const safeName = path.basename(filename);

  if (!adminSession && clientSession) {
    const expectedUrl = `/api/interview/recording/${safeName}`;
    const owned = await prisma.aiInterviewSession.findFirst({
      where: {
        recordingUrl: expectedUrl,
        pipelineRequest: { clientId: clientSession.clientId },
      },
      select: { id: true },
    });
    if (!owned) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const absPath = path.join(resolveUploadStorageDir("interviews"), safeName);
  try {
    const buf = await fs.readFile(absPath);
    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": "video/webm",
        "Accept-Ranges": "bytes",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
        "Cache-Control": "no-store, private",
      },
    });
  } catch {
    return NextResponse.json({ error: "Recording not found." }, { status: 404 });
  }
}
