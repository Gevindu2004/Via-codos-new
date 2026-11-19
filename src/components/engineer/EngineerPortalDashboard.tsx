"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bot,
  Calendar,
  CheckCircle2,
  ClipboardList,
  Clock,
  ExternalLink,
  LogOut,
  MessageSquare,
  Plus,
  Send,
  Sparkles,
  UserCheck,
  Video,
} from "lucide-react";

interface TaskItem {
  id: string;
  talentId: string;
  pipelineRequestId: string | null;
  clientId: string | null;
  title: string;
  description: string | null;
  priority: string;
  status: string;
  dueDate: string | null;
  progressNotes: string | null;
  assignedBy: string;
  createdAt: string;
  updatedAt: string;
}

interface InterviewItem {
  id: string;
  token: string;
  scheduledSlot: string;
  timezone: string;
  status: string;
  questions: string[];
  transcript: Array<{
    question: string;
    answer: string;
    timestamp: string;
    aiEvaluation?: string;
  }>;
  aiSummary?: string | null;
  overallScore?: number | null;
}

interface EngagementItem {
  id: string;
  stage: string;
  requestNotes: string | null;
  client: {
    id: string;
    name: string;
    companyName: string;
    companyCountry: string | null;
    verificationStatus: string;
  };
  interviews: InterviewItem[];
  meetings: Array<{
    id: string;
    scheduledSlot: string;
    timezone: string;
    meetingLink: string | null;
    notes: string | null;
    status: string;
  }>;
}

interface MessageItem {
  id: string;
  pipelineRequestId: string;
  senderRole: string;
  senderName: string;
  body: string;
  createdAt: string;
}

interface WorkspacePayload {
  engineer: {
    id: string;
    profileCode: string;
    email: string;
    name: string;
    roleTitle: string;
    domainName: string;
    availability: string;
    placementStatus: string;
    skills: string[];
  };
  engagements: EngagementItem[];
  tasks: TaskItem[];
  messages: MessageItem[];
}

type PortalTab = "tasks" | "interviews" | "messages" | "meetings";

export function EngineerPortalDashboard() {
  const router = useRouter();
  const [data, setData] = useState<WorkspacePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<PortalTab>("tasks");
  const [bannerMsg, setBannerMsg] = useState<string | null>(null);

  // Tasks state
  const [taskFilter, setTaskFilter] = useState<string>("ALL");
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDesc, setNewTaskDesc] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState("MEDIUM");
  const [creatingTask, setCreatingTask] = useState(false);

  // Inline AI Interview answering state
  const [expandedInterviewId, setExpandedInterviewId] = useState<string | null>(null);
  const [answerDrafts, setAnswerDrafts] = useState<Record<string, Record<string, string>>>({});
  const [savingInterviewId, setSavingInterviewId] = useState<string | null>(null);

  // Direct client messaging state
  const [selectedPipeId, setSelectedPipeId] = useState<string>("");
  const [chatText, setChatText] = useState("");
  const [sendingMsg, setSendingMsg] = useState(false);

  const loadWorkspace = useCallback(async () => {
    try {
      const res = await fetch("/api/engineer/workspace", { cache: "no-store" });
      if (res.status === 401) {
        router.push("/engineer/login");
        return;
      }
      const json = (await res.json()) as WorkspacePayload;
      if (res.ok) {
        setData(json);
        setSelectedPipeId((prev) => prev || json.engagements[0]?.id || "");
        // Seed initial interview answer drafts from saved transcripts once
        setAnswerDrafts((prev) => {
          const next = { ...prev };
          for (const eng of json.engagements) {
            for (const iv of eng.interviews) {
              if (!next[iv.id]) {
                const map: Record<string, string> = {};
                iv.questions.forEach((_q, idx) => {
                  const saved = iv.transcript[idx]?.answer;
                  map[String(idx)] = saved && saved !== "(Pending answer)" ? saved : "";
                });
                next[iv.id] = map;
              }
            }
          }
          return next;
        });
      }
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void loadWorkspace();
    const timer = setInterval(() => void loadWorkspace(), 4500);
    return () => clearInterval(timer);
  }, [loadWorkspace]);

  const handleLogout = async () => {
    await fetch("/api/engineer/auth/logout", { method: "POST" });
    router.push("/engineer/login");
    router.refresh();
  };

  const handleUpdateTask = async (taskId: string, status: string) => {
    const res = await fetch("/api/engineer/tasks", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        taskId,
        status,
        progressNotes: noteDrafts[taskId],
      }),
    });
    if (res.ok) {
      setBannerMsg("Task status & notes updated.");
      setTimeout(() => setBannerMsg(null), 3500);
      await loadWorkspace();
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    setCreatingTask(true);
    try {
      const activeEng = data?.engagements[0];
      const res = await fetch("/api/engineer/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTaskTitle.trim(),
          description: newTaskDesc.trim() || null,
          priority: newTaskPriority,
          pipelineRequestId: activeEng?.id || null,
          clientId: activeEng?.client.id || null,
        }),
      });
      if (res.ok) {
        setNewTaskTitle("");
        setNewTaskDesc("");
        setBannerMsg("Task added to your board.");
        setTimeout(() => setBannerMsg(null), 3500);
        await loadWorkspace();
      }
    } finally {
      setCreatingTask(false);
    }
  };

  const handleSaveInterviewAnswers = async (interviewId: string, submitFinal: boolean) => {
    setSavingInterviewId(interviewId);
    try {
      const res = await fetch(`/api/engineer/interviews/${interviewId}/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answers: answerDrafts[interviewId] || {},
          submitFinal,
        }),
      });
      const json = await res.json();
      if (res.ok) {
        setBannerMsg(
          submitFinal
            ? "AI Interview answers finalized and shared with your hiring client."
            : "Draft answers saved cleanly."
        );
        setTimeout(() => setBannerMsg(null), 4000);
        await loadWorkspace();
      } else {
        alert(json.error || "Failed to save answers.");
      }
    } finally {
      setSavingInterviewId(null);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPipeId || !chatText.trim()) return;
    setSendingMsg(true);
    try {
      const res = await fetch("/api/engineer/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pipelineRequestId: selectedPipeId,
          body: chatText.trim(),
        }),
      });
      if (res.ok) {
        setChatText("");
        await loadWorkspace();
      }
    } finally {
      setSendingMsg(false);
    }
  };

  if (loading || !data) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-sm text-slate-500">
        Loading your Engineer Workspace...
      </div>
    );
  }

  const allInterviews = data.engagements.flatMap((eng) =>
    eng.interviews.map((iv) => ({ ...iv, engagement: eng }))
  );
  const allMeetings = data.engagements.flatMap((eng) =>
    eng.meetings.map((m) => ({ ...m, engagement: eng }))
  );
  const filteredTasks = data.tasks.filter(
    (t) => taskFilter === "ALL" || t.status === taskFilter
  );
  const activeMessages = data.messages.filter(
    (m) => m.pipelineRequestId === selectedPipeId
  );

  return (
    <div className="bg-[#F8FAFC] min-h-screen py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-6">
        {/* Top Engineer Identity & Status Header */}
        <div className="rounded-2xl bg-[#0A192F] text-white p-6 sm:p-8 shadow-lg flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-md bg-sky-400/20 px-2.5 py-0.5 text-xs font-bold text-sky-300">
                {data.engineer.profileCode}
              </span>
              <span className="text-xs text-slate-300">{data.engineer.domainName}</span>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-300">
                <UserCheck className="h-3 w-3" /> {data.engineer.availability.replace("_", " ")}
              </span>
            </div>
            <h1 className="font-heading text-2xl sm:text-3xl font-extrabold">
              Engineer Workspace — {data.engineer.roleTitle}
            </h1>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {data.engineer.skills.slice(0, 8).map((s) => (
                <span
                  key={s}
                  className="rounded bg-white/10 px-2 py-0.5 text-[11px] font-medium text-slate-200"
                >
                  {s}
                </span>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/25 px-4 py-2 text-xs font-semibold text-white hover:bg-white/10 transition"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign Out
            </button>
          </div>
        </div>

        {bannerMsg && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-800">
            {bannerMsg}
          </div>
        )}

        {/* Quick Metric Navigation Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              id: "tasks" as const,
              label: "Assigned Tasks",
              count: data.tasks.length,
              sub: `${data.tasks.filter((t) => t.status !== "DONE").length} open`,
              icon: ClipboardList,
            },
            {
              id: "interviews" as const,
              label: "AI & Live Interviews",
              count: allInterviews.length,
              sub: `${allInterviews.filter((i) => i.status !== "COMPLETED").length} upcoming/live`,
              icon: Video,
            },
            {
              id: "messages" as const,
              label: "Client Communication",
              count: data.messages.length,
              sub: `${data.engagements.length} active client(s)`,
              icon: MessageSquare,
            },
            {
              id: "meetings" as const,
              label: "Management Calls",
              count: allMeetings.length,
              sub: "3-way scheduled sessions",
              icon: Calendar,
            },
          ].map((card) => {
            const Icon = card.icon;
            const active = activeTab === card.id;
            return (
              <button
                key={card.id}
                type="button"
                onClick={() => setActiveTab(card.id)}
                className={`text-left rounded-2xl border p-4 transition ${
                  active
                    ? "border-[#0A192F] bg-[#0A192F] text-white shadow-md"
                    : "border-slate-200 bg-white text-[#0A0F1A] hover:border-[#0A192F]"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-semibold ${active ? "text-sky-300" : "text-slate-500"}`}>
                    {card.label}
                  </span>
                  <Icon className={`h-4 w-4 ${active ? "text-sky-300" : "text-[#1D4ED8]"}`} />
                </div>
                <div className="font-heading text-2xl font-extrabold mt-1">{card.count}</div>
                <div className={`text-[11px] mt-0.5 ${active ? "text-slate-300" : "text-slate-500"}`}>
                  {card.sub}
                </div>
              </button>
            );
          })}
        </div>

        {/* ==================================================================
            TAB 1: TASKS BOARD
           ================================================================== */}
        {activeTab === "tasks" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="font-heading text-lg font-bold text-[#0A0F1A]">
                  My Engineering Tasks &amp; Deliverables
                </h2>
                <div className="flex flex-wrap gap-1.5">
                  {["ALL", "TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"].map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setTaskFilter(st)}
                      className={`rounded-full px-3 py-1 text-[11px] font-semibold border transition ${
                        taskFilter === st
                          ? "bg-[#0A192F] text-white border-[#0A192F]"
                          : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"
                      }`}
                    >
                      {st.replace("_", " ")}
                    </button>
                  ))}
                </div>
              </div>

              {filteredTasks.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
                  No tasks match this filter.
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredTasks.map((t) => (
                    <div
                      key={t.id}
                      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                                t.priority === "HIGH"
                                  ? "bg-rose-100 text-rose-700"
                                  : t.priority === "MEDIUM"
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-slate-100 text-slate-600"
                              }`}
                            >
                              {t.priority} PRIORITY
                            </span>
                            <span className="text-[11px] text-slate-500">
                              Assigned by: <strong>{t.assignedBy}</strong>
                            </span>
                            {t.dueDate && (
                              <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
                                <Clock className="h-3 w-3" /> Due {t.dueDate}
                              </span>
                            )}
                          </div>
                          <h3 className="font-heading text-base font-bold text-[#0A0F1A] mt-1">
                            {t.title}
                          </h3>
                        </div>

                        <select
                          value={t.status}
                          onChange={(e) => void handleUpdateTask(t.id, e.target.value)}
                          className="rounded-full border border-slate-300 bg-[#F8FAFC] px-3 py-1 text-xs font-bold text-[#0A192F]"
                        >
                          <option value="TODO">TODO</option>
                          <option value="IN_PROGRESS">IN PROGRESS</option>
                          <option value="IN_REVIEW">IN REVIEW</option>
                          <option value="DONE">DONE</option>
                        </select>
                      </div>

                      {t.description && (
                        <p className="text-xs text-slate-600 leading-relaxed">{t.description}</p>
                      )}

                      <div className="flex flex-col sm:flex-row gap-2 pt-1">
                        <input
                          type="text"
                          value={noteDrafts[t.id] ?? t.progressNotes ?? ""}
                          onChange={(e) =>
                            setNoteDrafts({ ...noteDrafts, [t.id]: e.target.value })
                          }
                          placeholder="Add progress update or PR/deliverable note..."
                          className="flex-1 rounded-xl border border-slate-200 px-3 py-1.5 text-xs focus:border-[#0A192F] focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => void handleUpdateTask(t.id, t.status)}
                          className="rounded-xl bg-[#0A192F] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#1E3A8A]"
                        >
                          Save Note
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Add Personal Subtask Sidebar */}
            <div className="lg:col-span-4">
              <form
                onSubmit={handleCreateTask}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3"
              >
                <div className="flex items-center gap-2 text-xs font-bold text-[#0A192F]">
                  <Plus className="h-4 w-4 text-[#1D4ED8]" />
                  Add Personal Milestone Task
                </div>
                <input
                  type="text"
                  required
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  placeholder="Task title..."
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs focus:border-[#0A192F] focus:outline-none"
                />
                <textarea
                  rows={3}
                  value={newTaskDesc}
                  onChange={(e) => setNewTaskDesc(e.target.value)}
                  placeholder="Optional technical notes..."
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs focus:border-[#0A192F] focus:outline-none"
                />
                <select
                  value={newTaskPriority}
                  onChange={(e) => setNewTaskPriority(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
                >
                  <option value="HIGH">High Priority</option>
                  <option value="MEDIUM">Medium Priority</option>
                  <option value="LOW">Low Priority</option>
                </select>
                <button
                  type="submit"
                  disabled={creatingTask}
                  className="w-full rounded-full bg-[#0A192F] py-2.5 text-xs font-bold text-white hover:bg-[#1E3A8A] disabled:opacity-50"
                >
                  {creatingTask ? "Adding..." : "Add Task to Board"}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ==================================================================
            TAB 2: LIVE INTERVIEWS & ANSWER AI QUESTIONS
           ================================================================== */}
        {activeTab === "interviews" && (
          <div className="space-y-4">
            <h2 className="font-heading text-lg font-bold text-[#0A0F1A]">
              Scheduled Live Interviews &amp; AI Questionnaires
            </h2>
            {allInterviews.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
                No AI or live interviews have been scheduled yet.
              </div>
            ) : (
              allInterviews.map((iv) => {
                const isExpanded = expandedInterviewId === iv.id;
                const drafts = answerDrafts[iv.id] || {};
                return (
                  <div
                    key={iv.id}
                    className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4"
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${
                              iv.status === "COMPLETED"
                                ? "bg-emerald-100 text-emerald-800"
                                : iv.status === "IN_PROGRESS"
                                ? "bg-rose-100 text-rose-700"
                                : "bg-sky-100 text-[#1D4ED8]"
                            }`}
                          >
                            {iv.status}
                          </span>
                          <span className="text-xs font-bold text-[#0A192F]">
                            {iv.engagement.client.companyName}
                          </span>
                          <span className="text-xs text-slate-500">
                            · {iv.questions.length} Question(s)
                          </span>
                        </div>
                        <div className="text-xs text-slate-600">
                          Scheduled Slot: <strong>{new Date(iv.scheduledSlot).toLocaleString()}</strong> ({iv.timezone})
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2.5">
                        <Link
                          href={`/interview/${iv.token}`}
                          className="inline-flex items-center gap-1.5 rounded-full bg-[#1D4ED8] px-5 py-2 text-xs font-bold text-white hover:bg-[#0A192F] transition"
                        >
                          <Video className="h-3.5 w-3.5" />
                          Join Live AI Video Room
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedInterviewId(isExpanded ? null : iv.id)
                          }
                          className="inline-flex items-center gap-1.5 rounded-full border border-[#0A192F] px-4 py-2 text-xs font-semibold text-[#0A192F] hover:bg-slate-50 transition"
                        >
                          <Bot className="h-3.5 w-3.5" />
                          {isExpanded ? "Hide Written Q&A" : "Answer AI Questions Here"}
                        </button>
                      </div>
                    </div>

                    {iv.aiSummary && (
                      <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3.5 text-xs text-emerald-900 flex flex-wrap items-center justify-between gap-2">
                        <span>{iv.aiSummary}</span>
                        {iv.overallScore != null && (
                          <span className="rounded-full bg-emerald-700 px-3 py-0.5 text-[11px] font-bold text-white">
                            Score: {iv.overallScore}/100
                          </span>
                        )}
                      </div>
                    )}

                    {/* Expanded Inline AI Question Answering Section */}
                    {(isExpanded || iv.status !== "COMPLETED") && (
                      <div className="space-y-3 pt-1">
                        <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                          AI Interview Prompts ({iv.questions.length})
                        </div>
                        {iv.questions.map((q, qIdx) => (
                          <div
                            key={qIdx}
                            className="rounded-xl border border-slate-200 bg-[#F8FAFC] p-4 space-y-2"
                          >
                            <div className="text-xs font-bold text-[#0A192F]">
                              Question {qIdx + 1}: {q}
                            </div>
                            <textarea
                              rows={3}
                              value={drafts[String(qIdx)] ?? ""}
                              onChange={(e) =>
                                setAnswerDrafts({
                                  ...answerDrafts,
                                  [iv.id]: {
                                    ...(answerDrafts[iv.id] || {}),
                                    [String(qIdx)]: e.target.value,
                                  },
                                })
                              }
                              placeholder="Write your technical answer for this AI interview question..."
                              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs focus:border-[#0A192F] focus:outline-none"
                            />
                          </div>
                        ))}

                        <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
                          <button
                            type="button"
                            disabled={savingInterviewId === iv.id}
                            onClick={() => void handleSaveInterviewAnswers(iv.id, false)}
                            className="rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                          >
                            Save Draft Answers
                          </button>
                          <button
                            type="button"
                            disabled={savingInterviewId === iv.id}
                            onClick={() => void handleSaveInterviewAnswers(iv.id, true)}
                            className="inline-flex items-center gap-1.5 rounded-full bg-[#0A192F] px-5 py-2 text-xs font-bold text-white hover:bg-[#1E3A8A] disabled:opacity-50"
                          >
                            <Sparkles className="h-3.5 w-3.5" />
                            {savingInterviewId === iv.id
                              ? "Submitting..."
                              : "Submit All AI Answers"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ==================================================================
            TAB 3: CLIENT COMMUNICATION THREAD
           ================================================================== */}
        {activeTab === "messages" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-4 space-y-2.5">
              <h2 className="font-heading text-sm font-bold text-[#0A0F1A]">
                Client Engagements
              </h2>
              {data.engagements.map((eng) => {
                const selected = eng.id === selectedPipeId;
                return (
                  <button
                    key={eng.id}
                    type="button"
                    onClick={() => setSelectedPipeId(eng.id)}
                    className={`w-full text-left rounded-2xl border p-4 transition ${
                      selected
                        ? "border-[#0A192F] bg-[#0A192F] text-white"
                        : "border-slate-200 bg-white text-[#0A0F1A] hover:border-[#0A192F]"
                    }`}
                  >
                    <div className="font-bold text-sm">{eng.client.companyName}</div>
                    <div className={`text-xs mt-0.5 ${selected ? "text-sky-300" : "text-slate-500"}`}>
                      Contact: {eng.client.name} · Stage: {eng.stage}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="lg:col-span-8 rounded-2xl border border-slate-200 bg-white shadow-sm flex flex-col overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-[#F8FAFC]">
                <div>
                  <div className="font-heading text-sm font-bold text-[#0A192F]">
                    Direct Client Thread
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Share technical clarifications, schedules, or deliverable updates with the hiring client.
                  </div>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700">
                  <CheckCircle2 className="h-3 w-3" /> Synced Live
                </span>
              </div>

              <div className="p-6 space-y-3 max-h-[380px] overflow-y-auto flex-1">
                {activeMessages.length === 0 ? (
                  <div className="text-xs text-slate-500 text-center py-8">
                    No messages yet in this client channel. Start the conversation below.
                  </div>
                ) : (
                  activeMessages.map((msg) => {
                    const isMe = msg.senderRole === "engineer";
                    return (
                      <div
                        key={msg.id}
                        className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
                      >
                        <div className="text-[10px] text-slate-400 mb-1">
                          {msg.senderName} · {new Date(msg.createdAt).toLocaleString()}
                        </div>
                        <div
                          className={`max-w-[82%] rounded-2xl px-4 py-2.5 text-xs leading-relaxed ${
                            isMe
                              ? "bg-[#0A192F] text-white"
                              : "bg-slate-100 text-[#0A0F1A] border border-slate-200"
                          }`}
                        >
                          {msg.body}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <form
                onSubmit={handleSendMessage}
                className="border-t border-slate-200 p-4 flex gap-2 bg-[#F8FAFC]"
              >
                <input
                  type="text"
                  value={chatText}
                  onChange={(e) => setChatText(e.target.value)}
                  placeholder="Write a message to your hiring client..."
                  className="flex-1 rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs focus:border-[#0A192F] focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={sendingMsg || !chatText.trim()}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#0A192F] px-5 py-2 text-xs font-bold text-white hover:bg-[#1E3A8A] disabled:opacity-50"
                >
                  <Send className="h-3.5 w-3.5" />
                  {sendingMsg ? "Sending..." : "Send"}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ==================================================================
            TAB 4: 3-WAY MANAGEMENT MEETINGS
           ================================================================== */}
        {activeTab === "meetings" && (
          <div className="space-y-4">
            <h2 className="font-heading text-lg font-bold text-[#0A0F1A]">
              3-Way Management Meetings
            </h2>
            {allMeetings.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
                No 3-way management calls scheduled yet.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {allMeetings.map((m) => (
                  <div
                    key={m.id}
                    className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-2"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-[#0A192F]">{m.engagement.client.companyName}</span>
                      <span className="rounded-full bg-sky-100 px-2.5 py-0.5 text-[10px] font-bold text-[#1D4ED8]">
                        {m.status}
                      </span>
                    </div>
                    <div className="text-xs text-slate-600">
                      Slot: <strong>{new Date(m.scheduledSlot).toLocaleString()}</strong> ({m.timezone})
                    </div>
                    {m.meetingLink && (
                      <div className="font-mono text-xs text-[#1D4ED8] break-all">
                        {m.meetingLink}
                      </div>
                    )}
                    {m.notes && (
                      <div className="rounded-lg bg-[#F8FAFC] border border-slate-200 p-2.5 text-xs text-slate-600">
                        {m.notes}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

