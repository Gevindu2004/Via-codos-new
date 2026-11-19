"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ShieldCheck,
  Clock,
  CheckCircle2,
  Bot,
  Calendar,
  FileSignature,
  LogOut,
  Plus,
  ExternalLink,
  Video,
  Users,
  MessageSquare,
  ClipboardList,
  Send,
} from "lucide-react";

const PIPELINE_STAGES = [
  "REQUESTED",
  "APPROVED",
  "INTERVIEW",
  "MEETING",
  "CONTRACT",
  "HIRED",
] as const;

const DEFAULT_AI_QUESTIONS = [
  "Walk us through the most complex system or operational turnaround you led recently and the measurable outcome.",
  "How do you handle architecture trade-offs, testing discipline, and handoffs in remote multi-timezone pods?",
  "Describe a high-pressure production incident or deadline bottleneck and how you resolved it.",
];

interface PipelineItem {
  id: string;
  stage: string;
  requestNotes: string | null;
  adminApprovalNotes: string | null;
  releasedDossier: {
    profileCode?: string;
    architectureStrengths?: string[];
    timezoneOverlap?: string;
    vettingScores?: Record<string, string>;
  } | null;
  talent: {
    id: string;
    profileCode: string;
    domainName: string;
    roleTitle: string;
    yearsExperience: number;
    monthlyRateUsd: number;
    placementStatus: string;
    skills: string[];
  };
  interviews: Array<{
    id: string;
    token: string;
    scheduledSlot: string;
    timezone: string;
    questionsJson: string;
    status: string;
    recordingUrl: string | null;
    transcriptJson: string | null;
    aiSummary: string | null;
    overallScore: number | null;
  }>;
  meetings: Array<{
    id: string;
    scheduledSlot: string;
    timezone: string;
    meetingLink: string | null;
    notes: string | null;
    status: string;
  }>;
  signatureRequests: Array<{
    id: string;
    token: string;
    documentTitle: string;
    status: string;
    signedPdfPath: string | null;
  }>;
}

interface ClientInfo {
  id: string;
  name: string;
  email: string;
  companyName: string;
  verificationStatus: string;
  verificationNotes: string | null;
}

export function ClientPortalDashboard() {
  const router = useRouter();
  const [client, setClient] = useState<ClientInfo | null>(null);
  const [requests, setRequests] = useState<PipelineItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal state for AI Interview Scheduling
  const [interviewModalPipe, setInterviewModalPipe] = useState<PipelineItem | null>(null);
  const [interviewSlot, setInterviewSlot] = useState(
    new Date(Date.now() + 86400000).toISOString().slice(0, 16)
  );
  const [interviewTz, setInterviewTz] = useState("UTC");
  const [questions, setQuestions] = useState<string[]>(DEFAULT_AI_QUESTIONS);
  const [newQuestion, setNewQuestion] = useState("");

  // Modal state for 3-way Management Meeting
  const [meetingModalPipe, setMeetingModalPipe] = useState<PipelineItem | null>(null);
  const [meetingSlot, setMeetingSlot] = useState(
    new Date(Date.now() + 172800000).toISOString().slice(0, 16)
  );
  const [meetingNotes, setMeetingNotes] = useState("");
  const [editingNoteMap, setEditingNoteMap] = useState<Record<string, string>>({});

  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [messagesByPipe, setMessagesByPipe] = useState<
    Record<
      string,
      Array<{ id: string; senderRole: string; senderName: string; body: string; createdAt: string }>
    >
  >({});
  const [tasksByPipe, setTasksByPipe] = useState<
    Record<
      string,
      Array<{
        id: string;
        title: string;
        status: string;
        priority: string;
        progressNotes: string | null;
      }>
    >
  >({});
  const [msgDraftMap, setMsgDraftMap] = useState<Record<string, string>>({});
  const [taskTitleDraftMap, setTaskTitleDraftMap] = useState<Record<string, string>>({});

  const loadCollaboration = async () => {
    try {
      const res = await fetch("/api/portal/collaboration", { cache: "no-store" });
      if (res.ok) {
        const col = await res.json();
        setMessagesByPipe(col.messagesByPipe || {});
        setTasksByPipe(col.tasksByPipe || {});
      }
    } catch {
      // Ignore transient poll errors
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/portal/requests");
      if (res.status === 401) {
        router.push("/portal/login");
        return;
      }
      const data = await res.json();
      setClient(data.client);
      setRequests(data.requests || []);
      await loadCollaboration();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const timer = setInterval(() => void loadCollaboration(), 5000);
    return () => clearInterval(timer);
  }, []);

  const handleSendClientMessage = async (pipeId: string) => {
    const text = (msgDraftMap[pipeId] || "").trim();
    if (!text) return;
    const res = await fetch("/api/portal/collaboration", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pipelineRequestId: pipeId, type: "MESSAGE", body: text }),
    });
    if (res.ok) {
      setMsgDraftMap({ ...msgDraftMap, [pipeId]: "" });
      await loadCollaboration();
    }
  };

  const handleAssignTaskToEngineer = async (pipeId: string) => {
    const title = (taskTitleDraftMap[pipeId] || "").trim();
    if (!title) return;
    const res = await fetch("/api/portal/collaboration", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pipelineRequestId: pipeId,
        type: "TASK",
        title,
        priority: "HIGH",
      }),
    });
    if (res.ok) {
      setTaskTitleDraftMap({ ...taskTitleDraftMap, [pipeId]: "" });
      setActionMsg("Task assigned directly to the engineer's portal.");
      await loadCollaboration();
    }
  };

  const handleLogout = async () => {
    await fetch("/api/portal/auth/logout", { method: "POST" });
    router.push("/portal/login");
    router.refresh();
  };

  const handleScheduleInterview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!interviewModalPipe) return;
    const res = await fetch("/api/portal/interviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pipelineRequestId: interviewModalPipe.id,
        scheduledSlot: interviewSlot,
        timezone: interviewTz,
        questions,
      }),
    });
    const data = await res.json();
    if (res.ok) {
      setInterviewModalPipe(null);
      setActionMsg(
        `AI Interview scheduled & candidate invited! Room link: /interview/${data.interview.token}`
      );
      loadData();
    } else {
      alert(data.error || "Failed to schedule interview.");
    }
  };

  const handleBookMeeting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!meetingModalPipe) return;
    const res = await fetch("/api/portal/meetings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pipelineRequestId: meetingModalPipe.id,
        scheduledSlot: meetingSlot,
        timezone: "UTC",
        notes: meetingNotes,
      }),
    });
    const data = await res.json();
    if (res.ok) {
      setMeetingModalPipe(null);
      setMeetingNotes("");
      setActionMsg("3-Way Meet via Codos Management booked!");
      loadData();
    } else {
      alert(data.error || "Failed to book meeting.");
    }
  };

  const handleSaveMeetingNotes = async (meetingId: string) => {
    const notes = editingNoteMap[meetingId] ?? "";
    const res = await fetch("/api/portal/meetings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ meetingId, notes }),
    });
    if (res.ok) {
      setActionMsg("Meeting notes saved.");
      loadData();
    }
  };

  const handleGenerateContract = async (pipeId: string) => {
    const res = await fetch("/api/portal/contracts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pipelineRequestId: pipeId }),
    });
    const data = await res.json();
    if (res.ok && data.signUrl) {
      router.push(data.signUrl);
    } else {
      alert(data.error || "Unable to generate contract.");
    }
  };

  if (loading) {
    return (
      <div className="py-20 text-center text-sm text-slate-500">
        Loading Client Pipeline Portal...
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Top Client Organization Status Card */}
      {client && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="font-heading text-xl font-extrabold text-[#0A0F1A]">
                {client.companyName}
              </h2>
              <span
                className={`rounded-full px-3 py-0.5 text-[11px] font-bold uppercase ${
                  client.verificationStatus === "VERIFIED"
                    ? "bg-emerald-100 text-emerald-800"
                    : client.verificationStatus === "REJECTED"
                    ? "bg-red-100 text-red-800"
                    : "bg-amber-100 text-amber-800"
                }`}
              >
                {client.verificationStatus === "VERIFIED"
                  ? "✓ Company Verified"
                  : `Verification: ${client.verificationStatus}`}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Signed in as {client.name} ({client.email})
            </p>
            {client.verificationNotes && (
              <p className="text-xs text-slate-600 mt-1">{client.verificationNotes}</p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/talent"
              className="rounded-full bg-[#0A192F] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1E3A8A]"
            >
              + Browse &amp; Request Profiles
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <LogOut className="h-3.5 w-3.5" /> Sign Out
            </button>
          </div>
        </div>
      )}

      {actionMsg && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-800 flex items-center justify-between">
          <span>{actionMsg}</span>
          <button type="button" onClick={() => setActionMsg(null)} className="underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Requests Pipeline */}
      {requests.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center space-y-4">
          <Users className="h-10 w-10 text-slate-400 mx-auto" />
          <h3 className="font-heading text-lg font-bold text-[#0A0F1A]">
            No Talent Requests in Your Pipeline Yet
          </h3>
          <p className="text-sm text-slate-600 max-w-md mx-auto">
            Browse our anonymized IT, legacy mainframe, and management bench and click &ldquo;Request Full Profile&rdquo; to start your hiring pipeline.
          </p>
          <Link
            href="/talent"
            className="inline-flex rounded-full bg-[#0A192F] px-6 py-2.5 text-xs font-bold text-white hover:bg-[#1E3A8A]"
          >
            Browse Talent Bench →
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {requests.map((pipe) => {
            const stageIdx = PIPELINE_STAGES.indexOf(
              pipe.stage as (typeof PIPELINE_STAGES)[number]
            );
            const isApprovedOrLater = stageIdx >= 1;
            const latestInterview = pipe.interviews[0];
            const latestMeeting = pipe.meetings[0];
            const latestSig = pipe.signatureRequests[0];

            return (
              <div
                key={pipe.id}
                className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden"
              >
                {/* Header */}
                <div className="bg-[#0A192F] text-white px-6 py-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold bg-white/15 px-2.5 py-0.5 rounded">
                        {pipe.talent.profileCode}
                      </span>
                      <span className="text-xs text-sky-300">{pipe.talent.domainName}</span>
                    </div>
                    <h3 className="font-heading text-lg font-bold mt-1">
                      {pipe.talent.roleTitle}
                    </h3>
                  </div>

                  <div className="text-right">
                    <span className="inline-block rounded-full bg-sky-400/20 px-3 py-1 text-xs font-bold text-sky-200">
                      Stage: {pipe.stage}
                    </span>
                    {pipe.talent.placementStatus === "PLACED" && (
                      <div className="mt-1 text-[11px] font-bold text-emerald-300">
                        ✓ Engineer Marked Placed (Payroll/HR managed externally)
                      </div>
                    )}
                  </div>
                </div>

                {/* 6-Stage Pipeline Bar */}
                <div className="px-6 py-4 bg-[#F8FAFC] border-b border-slate-200 overflow-x-auto">
                  <div className="grid grid-cols-6 gap-2 min-w-[600px]">
                    {PIPELINE_STAGES.map((st, idx) => {
                      const done = stageIdx >= idx;
                      const current = pipe.stage === st;
                      return (
                        <div
                          key={st}
                          className={`rounded-lg px-2.5 py-2 text-center border text-[11px] font-bold ${
                            current
                              ? "border-[#1D4ED8] bg-[#1D4ED8] text-white"
                              : done
                              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                              : "border-slate-200 bg-white text-slate-400"
                          }`}
                        >
                          {idx + 1}. {st}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Body */}
                <div className="p-6 space-y-6">
                  {pipe.stage === "REQUESTED" && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex items-start gap-3 text-xs text-amber-900">
                      <Clock className="h-4 w-4 shrink-0 mt-0.5" />
                      <div>
                        <strong>Awaiting Admin Approval:</strong> Our team is reviewing your company verification and request before releasing the full engineering dossier and enabling AI interview scheduling.
                      </div>
                    </div>
                  )}

                  {/* Released Dossier */}
                  {isApprovedOrLater && pipe.releasedDossier && (
                    <div className="rounded-xl border border-slate-200 bg-[#F8FAFC] p-5 space-y-2">
                      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#1D4ED8]">
                        <ShieldCheck className="h-4 w-4" /> Approved Anonymized Full Dossier
                      </div>
                      {pipe.adminApprovalNotes && (
                        <p className="text-xs text-slate-600">{pipe.adminApprovalNotes}</p>
                      )}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs">
                        <div>
                          <strong>Timezone Overlap:</strong>{" "}
                          {pipe.releasedDossier.timezoneOverlap || "4–8 Hours"}
                        </div>
                        <div>
                          <strong>Rate:</strong> ${pipe.talent.monthlyRateUsd.toLocaleString()}/mo
                        </div>
                        <div>
                          <strong>Vetting Scores:</strong>{" "}
                          {pipe.releasedDossier.vettingScores
                            ? Object.entries(pipe.releasedDossier.vettingScores)
                                .map(([k, v]) => `${k}: ${v}`)
                                .join(" · ")
                            : "Passed 4-Stage Vetting"}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Action Step Cards (Interview -> Meeting -> Contract) */}
                  {isApprovedOrLater && pipe.stage !== "HIRED" && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* 1. AI Interview */}
                      <div className="rounded-xl border border-slate-200 p-4 space-y-3">
                        <div className="flex items-center gap-2 text-xs font-bold text-[#0A0F1A]">
                          <Bot className="h-4 w-4 text-[#1D4ED8]" />
                          Step 3: AI Interview
                        </div>
                        {latestInterview ? (
                          <div className="text-xs space-y-2.5">
                            <div className="flex items-center justify-between gap-2">
                              <span>
                                Status: <strong>{latestInterview.status}</strong>
                              </span>
                              {latestInterview.status === "IN_PROGRESS" && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-700">
                                  <span className="h-1.5 w-1.5 rounded-full bg-rose-600 animate-pulse" />
                                  LIVE NOW
                                </span>
                              )}
                            </div>
                            <div className="text-slate-500">
                              Slot: {new Date(latestInterview.scheduledSlot).toLocaleString()}
                            </div>
                            <div className="flex flex-col gap-1.5 pt-0.5">
                              <Link
                                href={`/interview/${latestInterview.token}?mode=client`}
                                className="inline-flex items-center justify-center gap-1.5 rounded-full bg-[#1D4ED8] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#0A192F] transition"
                              >
                                <Video className="h-3.5 w-3.5" />
                                Watch Live &amp; Interview Engineer
                              </Link>
                              <Link
                                href={`/interview/${latestInterview.token}`}
                                className="inline-flex items-center gap-1 text-[11px] text-slate-500 font-medium hover:text-[#1D4ED8] hover:underline"
                              >
                                Engineer Invite Room Link <ExternalLink className="h-3 w-3" />
                              </Link>
                            </div>
                          </div>
                        ) : (
                          <p className="text-xs text-slate-500">
                            Pick a slot, customize questions, watch the engineer live in real time, and ask live follow-up questions.
                          </p>
                        )}
                        <button
                          type="button"
                          onClick={() => setInterviewModalPipe(pipe)}
                          className="w-full rounded-full border border-[#0A192F] py-2 text-xs font-semibold text-[#0A192F] hover:bg-[#0A192F] hover:text-white transition"
                        >
                          {latestInterview ? "Schedule Another AI Interview" : "Schedule AI Interview"}
                        </button>
                      </div>

                      {/* 2. Meet via Codos Management */}
                      <div className="rounded-xl border border-slate-200 p-4 space-y-3">
                        <div className="flex items-center gap-2 text-xs font-bold text-[#0A0F1A]">
                          <Calendar className="h-4 w-4 text-[#1D4ED8]" />
                          Step 4: Meet via Codos Management
                        </div>
                        {latestMeeting ? (
                          <div className="text-xs space-y-2">
                            <div>
                              Slot: <strong>{new Date(latestMeeting.scheduledSlot).toLocaleString()}</strong>
                            </div>
                            {latestMeeting.meetingLink && (
                              <div className="font-mono text-[11px] text-[#1D4ED8] truncate">
                                {latestMeeting.meetingLink}
                              </div>
                            )}
                            <textarea
                              rows={2}
                              value={
                                editingNoteMap[latestMeeting.id] ?? latestMeeting.notes ?? ""
                              }
                              onChange={(e) =>
                                setEditingNoteMap({
                                  ...editingNoteMap,
                                  [latestMeeting.id]: e.target.value,
                                })
                              }
                              placeholder="3-way meeting notes..."
                              className="w-full rounded-lg border border-slate-200 p-2 text-xs"
                            />
                            <button
                              type="button"
                              onClick={() => handleSaveMeetingNotes(latestMeeting.id)}
                              className="text-[11px] font-semibold text-[#1D4ED8] hover:underline"
                            >
                              Save Meeting Notes
                            </button>
                          </div>
                        ) : (
                          <p className="text-xs text-slate-500">
                            Book a 3-way calendar session with you, Via Codos Management, and the candidate.
                          </p>
                        )}
                        <button
                          type="button"
                          onClick={() => setMeetingModalPipe(pipe)}
                          className="w-full rounded-full border border-[#0A192F] py-2 text-xs font-semibold text-[#0A192F] hover:bg-[#0A192F] hover:text-white transition"
                        >
                          Book 3-Way Management Call
                        </button>
                      </div>

                      {/* 3. Final Contract E-Sign */}
                      <div className="rounded-xl border border-slate-200 p-4 space-y-3 flex flex-col justify-between">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-xs font-bold text-[#0A0F1A]">
                            <FileSignature className="h-4 w-4 text-[#1D4ED8]" />
                            Step 5: Contract &amp; Sign-Off
                          </div>
                          <p className="text-xs text-slate-500">
                            Generate and electronically sign the Staff Augmentation SOW to finalize placement.
                          </p>
                        </div>
                        {latestSig ? (
                          <Link
                            href={`/sign/${latestSig.token}`}
                            className="w-full text-center rounded-full bg-[#0A192F] py-2 text-xs font-bold text-white hover:bg-[#1E3A8A]"
                          >
                            {latestSig.status === "SIGNED"
                              ? "View Executed Contract"
                              : "Open E-Sign Contract →"}
                          </Link>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleGenerateContract(pipe.id)}
                            className="w-full rounded-full bg-[#0A192F] py-2 text-xs font-bold text-white hover:bg-[#1E3A8A]"
                          >
                            Proceed to E-Sign Contract →
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Completed AI Interview Recording & Transcript Showcase */}
                  {latestInterview && latestInterview.status === "COMPLETED" && (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-5 space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2 text-xs font-bold text-emerald-900">
                          <Video className="h-4 w-4" />
                          AI Interview Recording &amp; Verified Transcript
                        </div>
                        <span className="rounded-full bg-emerald-700 px-3 py-0.5 text-[11px] font-bold text-white">
                          AI Score: {latestInterview.overallScore}/100
                        </span>
                      </div>
                      {latestInterview.aiSummary && (
                        <p className="text-xs text-slate-700">{latestInterview.aiSummary}</p>
                      )}
                      {latestInterview.recordingUrl && (
                        <video
                          controls
                          src={latestInterview.recordingUrl}
                          className="w-full max-w-md rounded-xl border border-slate-200 bg-black"
                        />
                      )}
                      {latestInterview.transcriptJson && (
                        <div className="space-y-2">
                          {(
                            JSON.parse(latestInterview.transcriptJson) as Array<{
                              question: string;
                              answer: string;
                              aiEvaluation?: string;
                            }>
                          ).map((item, qIdx) => (
                            <div
                              key={qIdx}
                              className="rounded-lg bg-white border border-slate-200 p-3 text-xs space-y-1"
                            >
                              <div className="font-bold text-[#0A192F]">
                                Q{qIdx + 1}: {item.question}
                              </div>
                              <div className="text-slate-700">{item.answer}</div>
                              {item.aiEvaluation && (
                                <div className="text-[11px] text-[#1D4ED8] font-medium">
                                  AI Note: {item.aiEvaluation}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Engineer Tasks & Live Client-Engineer Messaging */}
                  {isApprovedOrLater && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-1">
                      {/* Tasks Assigned to Engineer */}
                      <div className="rounded-xl border border-slate-200 bg-[#F8FAFC] p-4 space-y-3">
                        <div className="flex items-center justify-between text-xs font-bold text-[#0A192F]">
                          <span className="inline-flex items-center gap-1.5">
                            <ClipboardList className="h-4 w-4 text-[#1D4ED8]" />
                            Engineer Tasks ({(tasksByPipe[pipe.id] || []).length})
                          </span>
                        </div>
                        <div className="space-y-1.5 max-h-40 overflow-y-auto">
                          {(tasksByPipe[pipe.id] || []).length === 0 ? (
                            <div className="text-[11px] text-slate-500">
                              No tasks assigned yet. Add an onboarding or technical task below.
                            </div>
                          ) : (
                            (tasksByPipe[pipe.id] || []).map((t) => (
                              <div
                                key={t.id}
                                className="rounded-lg bg-white border border-slate-200 px-3 py-2 text-xs flex items-start justify-between gap-2"
                              >
                                <div>
                                  <div className="font-semibold text-[#0A0F1A]">{t.title}</div>
                                  {t.progressNotes && (
                                    <div className="text-[11px] text-slate-500 mt-0.5">
                                      Note: {t.progressNotes}
                                    </div>
                                  )}
                                </div>
                                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-[#0A192F] shrink-0">
                                  {t.status.replace("_", " ")}
                                </span>
                              </div>
                            ))
                          )}
                        </div>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={taskTitleDraftMap[pipe.id] || ""}
                            onChange={(e) =>
                              setTaskTitleDraftMap({
                                ...taskTitleDraftMap,
                                [pipe.id]: e.target.value,
                              })
                            }
                            placeholder="Assign a new task to engineer..."
                            className="flex-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
                          />
                          <button
                            type="button"
                            onClick={() => void handleAssignTaskToEngineer(pipe.id)}
                            className="rounded-lg bg-[#0A192F] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#1E3A8A]"
                          >
                            Assign
                          </button>
                        </div>
                      </div>

                      {/* Direct Message Engineer */}
                      <div className="rounded-xl border border-slate-200 bg-[#F8FAFC] p-4 space-y-3">
                        <div className="flex items-center justify-between text-xs font-bold text-[#0A192F]">
                          <span className="inline-flex items-center gap-1.5">
                            <MessageSquare className="h-4 w-4 text-[#1D4ED8]" />
                            Communicate with {pipe.talent.profileCode}
                          </span>
                        </div>
                        <div className="space-y-1.5 max-h-40 overflow-y-auto">
                          {(messagesByPipe[pipe.id] || []).length === 0 ? (
                            <div className="text-[11px] text-slate-500">
                              Start a direct message thread with {pipe.talent.profileCode}.
                            </div>
                          ) : (
                            (messagesByPipe[pipe.id] || []).map((m) => (
                              <div
                                key={m.id}
                                className={`rounded-lg px-3 py-2 text-xs ${
                                  m.senderRole === "client"
                                    ? "bg-[#0A192F] text-white ml-6"
                                    : "bg-white border border-slate-200 text-[#0A0F1A] mr-6"
                                }`}
                              >
                                <div className="text-[10px] opacity-75 mb-0.5">
                                  {m.senderName}
                                </div>
                                <div>{m.body}</div>
                              </div>
                            ))
                          )}
                        </div>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={msgDraftMap[pipe.id] || ""}
                            onChange={(e) =>
                              setMsgDraftMap({
                                ...msgDraftMap,
                                [pipe.id]: e.target.value,
                              })
                            }
                            placeholder={`Message ${pipe.talent.profileCode}...`}
                            className="flex-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
                          />
                          <button
                            type="button"
                            onClick={() => void handleSendClientMessage(pipe.id)}
                            className="inline-flex items-center gap-1 rounded-lg bg-[#1D4ED8] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#0A192F]"
                          >
                            <Send className="h-3 w-3" /> Send
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {pipe.stage === "HIRED" && (
                    <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-5 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className="h-6 w-6 text-emerald-700 shrink-0" />
                        <div className="text-xs text-emerald-900">
                          <strong>Placement Complete — Engineer Marked PLACED.</strong> Contract signed and archived. Payroll and internal HR operations are handled offline by Via Codos.
                        </div>
                      </div>
                      {latestSig?.signedPdfPath && (
                        <a
                          href={`/api/sign/${latestSig.token}/pdf`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-full bg-emerald-700 px-4 py-2 text-xs font-bold text-white shrink-0"
                        >
                          Signed PDF
                        </a>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Schedule AI Interview */}
      {interviewModalPipe && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <form
            onSubmit={handleScheduleInterview}
            className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl space-y-4"
          >
            <h3 className="font-heading text-lg font-bold text-[#0A0F1A]">
              Schedule AI Interview — {interviewModalPipe.talent.profileCode}
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1">Pick Slot</label>
                <input
                  required
                  type="datetime-local"
                  value={interviewSlot}
                  onChange={(e) => setInterviewSlot(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Timezone</label>
                <input
                  type="text"
                  value={interviewTz}
                  onChange={(e) => setInterviewTz(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold">
                Customize AI Interviewer Questions
              </label>
              {questions.map((q, idx) => (
                <div key={idx} className="flex gap-2">
                  <input
                    type="text"
                    value={q}
                    onChange={(e) => {
                      const next = [...questions];
                      next[idx] = e.target.value;
                      setQuestions(next);
                    }}
                    className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => setQuestions(questions.filter((_, i) => i !== idx))}
                    className="text-xs text-red-600 px-2"
                  >
                    Remove
                  </button>
                </div>
              ))}
              <div className="flex gap-2 pt-1">
                <input
                  type="text"
                  value={newQuestion}
                  onChange={(e) => setNewQuestion(e.target.value)}
                  placeholder="Add a custom question..."
                  className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (newQuestion.trim()) {
                      setQuestions([...questions, newQuestion.trim()]);
                      setNewQuestion("");
                    }
                  }}
                  className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold"
                >
                  <Plus className="h-3.5 w-3.5" /> Add
                </button>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setInterviewModalPipe(null)}
                className="rounded-full border border-slate-300 px-4 py-2 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-full bg-[#0A192F] px-5 py-2 text-xs font-bold text-white"
              >
                Send AI Interview Invitation
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Meet via Codos Management */}
      {meetingModalPipe && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <form
            onSubmit={handleBookMeeting}
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4"
          >
            <h3 className="font-heading text-lg font-bold text-[#0A0F1A]">
              Meet via Codos Management (3-Way Call)
            </h3>
            <p className="text-xs text-slate-600">
              Schedule a joint session with Client, Via Codos Delivery Management, and Candidate{" "}
              <strong>{meetingModalPipe.talent.profileCode}</strong>.
            </p>
            <div>
              <label className="block text-xs font-semibold mb-1">Calendar Date &amp; Time</label>
              <input
                required
                type="datetime-local"
                value={meetingSlot}
                onChange={(e) => setMeetingSlot(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Agenda / Meeting Notes</label>
              <textarea
                rows={3}
                value={meetingNotes}
                onChange={(e) => setMeetingNotes(e.target.value)}
                placeholder="Key topics, start date expectations, team structure..."
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setMeetingModalPipe(null)}
                className="rounded-full border border-slate-300 px-4 py-2 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-full bg-[#0A192F] px-5 py-2 text-xs font-bold text-white"
              >
                Confirm 3-Way Meeting
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

