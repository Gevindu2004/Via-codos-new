import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession, getClientSession } from "@/lib/auth";
import { safeJsonParse } from "@/lib/sanitize";
import {
  getRoomClientId,
  pushLiveAudioChunk,
  pushLiveSignal,
  readLiveSnapshot,
  setRoomClientId,
  touchClientPresence,
  touchEngineerPresence,
  type LiveSignal,
} from "@/lib/live-interview";

async function authorizeClientWatcher(clientId: string) {
  const [adminSession, clientSession] = await Promise.all([
    getAdminSession(),
    getClientSession(),
  ]);
  if (adminSession) return { ok: true as const };
  if (clientSession && clientSession.clientId === clientId) return { ok: true as const };
  return { ok: false as const };
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const { searchParams } = new URL(req.url);
  const viewer = searchParams.get("viewer") === "client" ? "client" : "candidate";
  const since = Number(searchParams.get("since") || "0") || 0;
  const sinceAudio = Number(searchParams.get("sinceAudio") || "0") || 0;

  const session = await prisma.aiInterviewSession.findUnique({
    where: { token },
    include: {
      pipelineRequest: {
        select: { clientId: true },
      },
    },
  });

  if (!session) {
    return NextResponse.json({ error: "Interview room not found." }, { status: 404 });
  }
  setRoomClientId(token, session.pipelineRequest.clientId);

  if (viewer === "client") {
    const auth = await authorizeClientWatcher(session.pipelineRequest.clientId);
    if (!auth.ok) {
      return NextResponse.json({ error: "Client authorization required." }, { status: 401 });
    }
    const coHost = searchParams.get("coHost") === "1";
    touchClientPresence(token, coHost);
  } else {
    touchEngineerPresence(token);
  }

  const snapshot = readLiveSnapshot(token, viewer, since, sinceAudio);
  return NextResponse.json({
    status: session.status,
    questions: safeJsonParse<string[]>(session.questionsJson, []),
    transcript: safeJsonParse<Array<{ question: string; answer: string; timestamp: string }>>(
      session.transcriptJson,
      []
    ),
    aiSummary: session.aiSummary,
    overallScore: session.overallScore,
    recordingUrl: session.recordingUrl,
    live: snapshot,
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const body = await req.json();
    const role = body.role === "client" ? "client" : "candidate";
    const action = String(body.action || "");

    // Fast path for high-frequency audio chunks once the room's clientId is cached
    if (action === "AUDIO_CHUNK") {
      let clientId = getRoomClientId(token);
      if (!clientId) {
        const s = await prisma.aiInterviewSession.findUnique({
          where: { token },
          include: { pipelineRequest: { select: { clientId: true } } },
        });
        if (!s) {
          return NextResponse.json({ error: "Interview room not found." }, { status: 404 });
        }
        clientId = s.pipelineRequest.clientId;
        setRoomClientId(token, clientId);
      }
      if (role === "client") {
        const auth = await authorizeClientWatcher(clientId);
        if (!auth.ok) {
          return NextResponse.json({ error: "Client authorization required." }, { status: 403 });
        }
        touchClientPresence(token);
      } else {
        touchEngineerPresence(token);
      }
      pushLiveAudioChunk(token, role, String(body.audioDataUrl || ""));
      return NextResponse.json({ ok: true });
    }

    const session = await prisma.aiInterviewSession.findUnique({
      where: { token },
      include: {
        pipelineRequest: {
          select: { clientId: true },
        },
      },
    });
    if (!session) {
      return NextResponse.json({ error: "Interview room not found." }, { status: 404 });
    }
    setRoomClientId(token, session.pipelineRequest.clientId);

    if (role === "client") {
      const auth = await authorizeClientWatcher(session.pipelineRequest.clientId);
      if (!auth.ok) {
        return NextResponse.json({ error: "Client authorization required." }, { status: 403 });
      }
      touchClientPresence(
        token,
        typeof body.coHostActive === "boolean" ? body.coHostActive : undefined,
        {
          isScreenSharing:
            typeof body.isScreenSharing === "boolean" ? body.isScreenSharing : undefined,
          screenFrameDataUrl:
            typeof body.screenFrameDataUrl === "string" ? body.screenFrameDataUrl : null,
          isVideoActive:
            typeof body.isVideoActive === "boolean" ? body.isVideoActive : undefined,
          videoFrameDataUrl:
            typeof body.videoFrameDataUrl === "string" ? body.videoFrameDataUrl : null,
        }
      );

      if (action === "SYNC_SCREEN" || action === "SYNC_CLIENT_MEDIA") {
        return NextResponse.json({ ok: true });
      }

      if (action === "ASK_LIVE_QUESTION") {
        const question = String(body.question || "").trim();
        if (!question || question.length > 500) {
          return NextResponse.json(
            { error: "Question must be between 1 and 500 characters." },
            { status: 400 }
          );
        }
        const existingQuestions = safeJsonParse<string[]>(session.questionsJson, []);
        const nextQuestions = [...existingQuestions, question];
        await prisma.aiInterviewSession.update({
          where: { id: session.id },
          data: { questionsJson: JSON.stringify(nextQuestions) },
        });
        return NextResponse.json({ ok: true, questions: nextQuestions });
      }

      if (action === "WEBRTC_SIGNAL") {
        const kind = body.kind as LiveSignal["kind"];
        if (!["offer", "answer", "ice", "renegotiate"].includes(kind)) {
          return NextResponse.json({ error: "Invalid signal kind." }, { status: 400 });
        }
        const signal = pushLiveSignal(token, "client", kind, body.payload);
        return NextResponse.json({ ok: true, signal });
      }

      if (action === "AUDIO_CHUNK") {
        pushLiveAudioChunk(token, "client", String(body.audioDataUrl || ""));
        return NextResponse.json({ ok: true });
      }

      return NextResponse.json({ ok: true });
    }

    // Candidate actions (scoped by secret interview room token)
    if (action === "ENGINEER_START") {
      if (session.status === "SCHEDULED") {
        await prisma.aiInterviewSession.update({
          where: { id: session.id },
          data: { status: "IN_PROGRESS" },
        });
      }
      touchEngineerPresence(token, {
        activeQuestionIndex: typeof body.activeQuestionIndex === "number" ? body.activeQuestionIndex : 0,
        liveDraftAnswer: typeof body.liveDraftAnswer === "string" ? body.liveDraftAnswer : "",
        isVideoActive: typeof body.isVideoActive === "boolean" ? body.isVideoActive : undefined,
      });
      return NextResponse.json({ ok: true });
    }

    if (action === "SYNC_STATE") {
      touchEngineerPresence(token, {
        activeQuestionIndex: typeof body.activeQuestionIndex === "number" ? body.activeQuestionIndex : undefined,
        liveDraftAnswer: typeof body.liveDraftAnswer === "string" ? body.liveDraftAnswer : undefined,
        liveFrameDataUrl: typeof body.liveFrameDataUrl === "string" ? body.liveFrameDataUrl : null,
        isScreenSharing: typeof body.isScreenSharing === "boolean" ? body.isScreenSharing : undefined,
        isVideoActive: typeof body.isVideoActive === "boolean" ? body.isVideoActive : undefined,
      });
      if (Array.isArray(body.completedTranscript)) {
        await prisma.aiInterviewSession.update({
          where: { id: session.id },
          data: { transcriptJson: JSON.stringify(body.completedTranscript) },
        });
      }
      return NextResponse.json({ ok: true });
    }

    if (action === "WEBRTC_SIGNAL") {
      const kind = body.kind as LiveSignal["kind"];
      if (!["offer", "answer", "ice", "renegotiate"].includes(kind)) {
        return NextResponse.json({ error: "Invalid signal kind." }, { status: 400 });
      }
      const signal = pushLiveSignal(token, "candidate", kind, body.payload);
      return NextResponse.json({ ok: true, signal });
    }

    if (action === "AUDIO_CHUNK") {
      pushLiveAudioChunk(token, "candidate", String(body.audioDataUrl || ""));
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (err) {
    console.error("Live interview signal error:", err);
    return NextResponse.json(
      {
        error:
          process.env.NODE_ENV !== "production" && err instanceof Error
            ? err.message
            : "Live interview sync failed.",
      },
      { status: 500 }
    );
  }
}

