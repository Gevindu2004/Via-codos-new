import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getEngineerSession } from "@/lib/auth";
import { createClientEngineerMessage } from "@/lib/engineer-store";

export async function POST(req: NextRequest) {
  const session = await getEngineerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const pipelineRequestId = String(body.pipelineRequestId || "").trim();
    const messageBody = String(body.body || "").trim();
    if (!pipelineRequestId || !messageBody || messageBody.length > 2000) {
      return NextResponse.json(
        { error: "Valid engagement ID and message (1–2000 chars) are required." },
        { status: 400 }
      );
    }

    const pipe = await prisma.profileRequest.findUnique({
      where: { id: pipelineRequestId },
      select: { id: true, talentId: true, clientId: true, stage: true },
    });
    if (!pipe || pipe.talentId !== session.talentId || pipe.stage === "REJECTED") {
      return NextResponse.json({ error: "Engagement not found." }, { status: 404 });
    }

    const msg = await createClientEngineerMessage({
      pipelineRequestId: pipe.id,
      talentId: session.talentId,
      clientId: pipe.clientId,
      senderRole: "engineer",
      senderName: `Engineer (${session.profileCode})`,
      body: messageBody,
    });

    return NextResponse.json({ message: msg });
  } catch (err) {
    console.error("Engineer send message error:", err);
    return NextResponse.json({ error: "Failed to send message." }, { status: 500 });
  }
}

