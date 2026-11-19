import { NextRequest, NextResponse } from "next/server";
import { getEngineerSession } from "@/lib/auth";
import { createEngineerTask, updateEngineerTask } from "@/lib/engineer-store";

export async function POST(req: NextRequest) {
  const session = await getEngineerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const title = String(body.title || "").trim();
    if (!title || title.length > 200) {
      return NextResponse.json({ error: "Task title is required (max 200 chars)." }, { status: 400 });
    }
    const task = await createEngineerTask({
      talentId: session.talentId,
      pipelineRequestId: body.pipelineRequestId ? String(body.pipelineRequestId) : null,
      clientId: body.clientId ? String(body.clientId) : null,
      title,
      description: body.description ? String(body.description).trim() : null,
      priority: body.priority ? String(body.priority) : "MEDIUM",
      dueDate: body.dueDate ? String(body.dueDate) : null,
      assignedBy: `${session.profileCode} (Self)`,
    });
    return NextResponse.json({ task });
  } catch (err) {
    console.error("Create engineer task error:", err);
    return NextResponse.json({ error: "Failed to create task." }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const session = await getEngineerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const taskId = String(body.taskId || "").trim();
    if (!taskId) {
      return NextResponse.json({ error: "taskId is required." }, { status: 400 });
    }
    const updated = await updateEngineerTask(taskId, session.talentId, {
      status: body.status ? String(body.status) : undefined,
      progressNotes:
        body.progressNotes !== undefined
          ? String(body.progressNotes || "").trim() || null
          : undefined,
    });
    if (!updated) {
      return NextResponse.json({ error: "Task not found." }, { status: 404 });
    }
    return NextResponse.json({ task: updated });
  } catch (err) {
    console.error("Update engineer task error:", err);
    return NextResponse.json({ error: "Failed to update task." }, { status: 500 });
  }
}

