import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getClientSession } from "@/lib/auth";
import {
  createClientEngineerMessage,
  createEngineerTask,
  listEngineerTasks,
  listMessagesForPipeline,
} from "@/lib/engineer-store";

export async function GET(req: NextRequest) {
  const session = await getClientSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const pipelineRequestId = searchParams.get("pipelineRequestId");

  const pipes = await prisma.profileRequest.findMany({
    where: {
      clientId: session.clientId,
      stage: { notIn: ["REQUESTED", "REJECTED"] },
      ...(pipelineRequestId ? { id: pipelineRequestId } : {}),
    },
    select: { id: true, talentId: true },
  });

  const messagesByPipe: Record<string, Awaited<ReturnType<typeof listMessagesForPipeline>>> = {};
  const tasksByPipe: Record<string, Awaited<ReturnType<typeof listEngineerTasks>>> = {};

  await Promise.all(
    pipes.map(async (p) => {
      const [msgs, allTalentTasks] = await Promise.all([
        listMessagesForPipeline(p.id),
        listEngineerTasks(p.talentId),
      ]);
      messagesByPipe[p.id] = msgs;
      tasksByPipe[p.id] = allTalentTasks.filter(
        (t) => t.pipelineRequestId === p.id || t.clientId === session.clientId
      );
    })
  );

  return NextResponse.json({ messagesByPipe, tasksByPipe });
}

export async function POST(req: NextRequest) {
  const session = await getClientSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const pipelineRequestId = String(body.pipelineRequestId || "").trim();
    const type = String(body.type || "").toUpperCase();

    const pipe = await prisma.profileRequest.findUnique({
      where: { id: pipelineRequestId },
      select: { id: true, clientId: true, talentId: true, stage: true },
    });
    if (!pipe || pipe.clientId !== session.clientId) {
      return NextResponse.json({ error: "Pipeline request not found." }, { status: 404 });
    }
    if (pipe.stage === "REQUESTED" || pipe.stage === "REJECTED") {
      return NextResponse.json(
        { error: "Admin must approve the profile before collaborating with the engineer." },
        { status: 403 }
      );
    }

    if (type === "MESSAGE") {
      const messageBody = String(body.body || "").trim();
      if (!messageBody || messageBody.length > 2000) {
        return NextResponse.json(
          { error: "Message must be between 1 and 2000 characters." },
          { status: 400 }
        );
      }
      const msg = await createClientEngineerMessage({
        pipelineRequestId: pipe.id,
        talentId: pipe.talentId,
        clientId: session.clientId,
        senderRole: "client",
        senderName: `${session.name} (${session.companyName})`,
        body: messageBody,
      });
      return NextResponse.json({ message: msg });
    }

    if (type === "TASK") {
      const title = String(body.title || "").trim();
      if (!title || title.length > 200) {
        return NextResponse.json({ error: "Task title is required (max 200 chars)." }, { status: 400 });
      }
      const task = await createEngineerTask({
        talentId: pipe.talentId,
        pipelineRequestId: pipe.id,
        clientId: session.clientId,
        title,
        description: body.description ? String(body.description).trim() : null,
        priority: body.priority ? String(body.priority) : "MEDIUM",
        dueDate: body.dueDate ? String(body.dueDate) : null,
        assignedBy: session.companyName,
      });
      return NextResponse.json({ task });
    }

    return NextResponse.json({ error: "Invalid collaboration action." }, { status: 400 });
  } catch (err) {
    console.error("Portal collaboration error:", err);
    return NextResponse.json({ error: "Failed to save collaboration action." }, { status: 500 });
  }
}

