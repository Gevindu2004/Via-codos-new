import React from "react";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getAdminSession, getClientSession } from "@/lib/auth";
import { safeJsonParse } from "@/lib/sanitize";
import { PublicShell } from "@/components/SiteChrome";
import { AiInterviewerRoom } from "@/components/AiInterviewerRoom";

export const dynamic = "force-dynamic";

export default async function InterviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ mode?: string }>;
}) {
  const [{ token }, { mode }, adminSession, clientSession] = await Promise.all([
    params,
    searchParams,
    getAdminSession(),
    getClientSession(),
  ]);

  const session = await prisma.aiInterviewSession.findUnique({
    where: { token },
    include: {
      pipelineRequest: {
        include: {
          talent: true,
          client: true,
        },
      },
    },
  });

  if (!session) notFound();

  const canWatchAsClient = Boolean(
    adminSession || (clientSession && clientSession.clientId === session.pipelineRequest.clientId)
  );
  const viewerRole: "client" | "candidate" =
    mode === "client" && canWatchAsClient ? "client" : "candidate";

  const questions = safeJsonParse<string[]>(session.questionsJson, []);
  const existingTranscript = safeJsonParse<
    Array<{ question: string; answer: string; timestamp: string }>
  >(session.transcriptJson, []);

  return (
    <PublicShell>
      <section className="bg-[#0A192F] text-white py-10 border-b border-white/10">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-xs font-bold uppercase tracking-widest text-sky-300">
              {viewerRole === "client"
                ? "Hiring Client Live Watch & Co-Interview Console"
                : "In-Browser AI Interviewer Room"}
            </div>
            <h1 className="font-heading mt-1 text-2xl sm:text-3xl font-extrabold">
              {session.pipelineRequest.talent.profileCode} — {session.pipelineRequest.talent.roleTitle}
            </h1>
            <p className="mt-1 text-xs text-slate-300">
              Scheduled Slot: {new Date(session.scheduledSlot).toLocaleString()} ({session.timezone})
            </p>
          </div>
        </div>
      </section>

      <section className="py-12 bg-[#F8FAFC]">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <AiInterviewerRoom
            token={session.token}
            profileCode={session.pipelineRequest.talent.profileCode}
            roleTitle={session.pipelineRequest.talent.roleTitle}
            companyName={session.pipelineRequest.client.companyName}
            questions={questions}
            existingStatus={session.status}
            existingSummary={session.aiSummary}
            existingScore={session.overallScore}
            existingRecordingUrl={session.recordingUrl}
            existingTranscript={existingTranscript}
            viewerRole={viewerRole}
          />
        </div>
      </section>
    </PublicShell>
  );
}

