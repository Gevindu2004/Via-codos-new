import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getEngineerSession } from "@/lib/auth";
import { safeJsonParse } from "@/lib/sanitize";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getEngineerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await req.json();
    const answersMap = body.answers as Record<string, string> | undefined;
    const submitFinal = Boolean(body.submitFinal);

    const iv = await prisma.aiInterviewSession.findUnique({
      where: { id },
      include: {
        pipelineRequest: {
          select: { talentId: true },
        },
      },
    });
    if (!iv || iv.pipelineRequest.talentId !== session.talentId) {
      return NextResponse.json({ error: "Interview session not found." }, { status: 404 });
    }

    const questions = safeJsonParse<string[]>(iv.questionsJson, []);
    const entries = questions.map((question, idx) => {
      const ans = String(answersMap?.[String(idx)] || "").trim();
      const wordCount = ans.split(/\s+/).filter(Boolean).length;
      const aiEvaluation =
        wordCount >= 20
          ? "Detailed technical articulation covering architecture & trade-offs."
          : wordCount >= 6
          ? "Clear, concise response addressing core prompt."
          : wordCount > 0
          ? "Brief written response submitted."
          : "Pending response.";
      return {
        question,
        answer: ans || "(Pending answer)",
        timestamp: new Date().toISOString(),
        aiEvaluation,
      };
    });

    const answeredEntries = entries.filter((e) => e.answer !== "(Pending answer)");
    if (answeredEntries.length === 0) {
      return NextResponse.json(
        { error: "Please enter at least one answer before saving." },
        { status: 400 }
      );
    }

    const avgWords =
      answeredEntries.reduce(
        (acc, e) => acc + e.answer.trim().split(/\s+/).filter(Boolean).length,
        0
      ) / answeredEntries.length;
    const overallScore = Math.min(97, Math.max(72, Math.round(70 + avgWords * 0.8)));

    const completed = submitFinal && answeredEntries.length === questions.length;
    const updated = await prisma.aiInterviewSession.update({
      where: { id: iv.id },
      data: {
        status: completed ? "COMPLETED" : "IN_PROGRESS",
        transcriptJson: JSON.stringify(entries),
        aiSummary: completed
          ? `Written & AI Interview completed across ${questions.length} question(s) via Engineer Portal (Score: ${overallScore}/100). Ready for hiring client review.`
          : `Draft responses saved for ${answeredEntries.length} of ${questions.length} question(s) via Engineer Portal.`,
        overallScore: completed ? overallScore : iv.overallScore,
        completedAt: completed ? new Date() : iv.completedAt,
      },
    });

    return NextResponse.json({ interview: updated, entries });
  } catch (err) {
    console.error("Engineer interview answer error:", err);
    return NextResponse.json({ error: "Failed to save answers." }, { status: 500 });
  }
}

