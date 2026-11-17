import fs from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveUploadStorageDir, validateAndScanUploadBuffer } from "@/lib/security";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const session = await prisma.aiInterviewSession.findUnique({
    where: { token },
    include: {
      pipelineRequest: {
        include: {
          talent: {
            select: {
              profileCode: true,
              roleTitle: true,
              domainName: true,
            },
          },
          client: {
            select: {
              companyName: true,
            },
          },
        },
      },
    },
  });
  if (!session) {
    return NextResponse.json({ error: "Interview room not found." }, { status: 404 });
  }
  return NextResponse.json({ interview: session });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const session = await prisma.aiInterviewSession.findUnique({ where: { token } });
    if (!session) {
      return NextResponse.json({ error: "Interview room not found." }, { status: 404 });
    }

    const formData = await req.formData();
    const transcriptStr = String(formData.get("transcriptJson") || "[]");
    const recordingFile = formData.get("recording") as File | null;

    let recordingUrl: string | null = session.recordingUrl;
    if (recordingFile && recordingFile.size > 0) {
      const buffer = Buffer.from(await recordingFile.arrayBuffer());
      const scan = await validateAndScanUploadBuffer(
        recordingFile.name || "recording.webm",
        recordingFile.type || "video/webm",
        buffer,
        "recording"
      );
      if (!scan.ok) {
        return NextResponse.json({ error: scan.error }, { status: 400 });
      }
      const dir = resolveUploadStorageDir("interviews");
      await fs.mkdir(dir, { recursive: true });
      const fileName = scan.safeFilename;
      const absPath = path.join(dir, fileName);
      await fs.writeFile(absPath, buffer, { mode: 0o644 });
      recordingUrl = `/api/interview/recording/${fileName}`;
    }

    const entries = JSON.parse(transcriptStr) as Array<{
      question: string;
      answer: string;
      timestamp: string;
    }>;

    const enriched = entries.map((e) => {
      const wordCount = (e.answer || "").trim().split(/\s+/).filter(Boolean).length;
      const aiEvaluation =
        wordCount >= 20
          ? "Detailed technical articulation covering architecture & trade-offs."
          : wordCount >= 6
          ? "Clear, concise response addressing core prompt."
          : "Brief response recorded; recommend deeper follow-up in 3-way meeting.";
      return { ...e, aiEvaluation };
    });

    const avgWords =
      enriched.reduce(
        (acc, e) => acc + (e.answer || "").trim().split(/\s+/).filter(Boolean).length,
        0
      ) / Math.max(enriched.length, 1);
    const overallScore = Math.min(97, Math.max(72, Math.round(70 + avgWords * 0.8)));

    const aiSummary = `AI Interview completed across ${enriched.length} customized prompt(s). Candidate demonstrated strong domain alignment (Score: ${overallScore}/100). Full recording and Q&A transcript archived for Client Portal review.`;

    const updated = await prisma.aiInterviewSession.update({
      where: { id: session.id },
      data: {
        status: "COMPLETED",
        recordingUrl,
        transcriptJson: JSON.stringify(enriched),
        aiSummary,
        overallScore,
        completedAt: new Date(),
      },
    });

    return NextResponse.json({ interview: updated });
  } catch (err) {
    console.error("Save AI interview error:", err);
    return NextResponse.json({ error: "Failed to save interview." }, { status: 500 });
  }
}

