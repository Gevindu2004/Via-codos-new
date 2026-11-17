import fs from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const sigReq = await prisma.signatureRequest.findUnique({ where: { token } });
  if (!sigReq || !sigReq.signedPdfPath) {
    return NextResponse.json({ error: "Signed PDF not found." }, { status: 404 });
  }
  const absPath = path.resolve(process.cwd(), sigReq.signedPdfPath);
  try {
    const fileBuffer = await fs.readFile(absPath);
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${sigReq.documentTitle.replace(/[^a-z0-9]+/gi, "-")}-SIGNED.pdf"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "PDF file unavailable on disk." }, { status: 404 });
  }
}

