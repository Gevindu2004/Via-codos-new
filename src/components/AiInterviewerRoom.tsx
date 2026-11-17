"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Video,
  Mic,
  Bot,
  CheckCircle2,
  ArrowRight,
  Play,
  Volume2,
  Square,
} from "lucide-react";

interface InterviewRoomProps {
  token: string;
  profileCode: string;
  roleTitle: string;
  companyName: string;
  questions: string[];
  existingStatus: string;
  existingSummary?: string | null;
}

export function AiInterviewerRoom({
  token,
  profileCode,
  roleTitle,
  companyName,
  questions,
  existingStatus,
  existingSummary,
}: InterviewRoomProps) {
  const [status, setStatus] = useState(existingStatus);
  const [started, setStarted] = useState(false);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answerText, setAnswerText] = useState("");
  const [transcript, setTranscript] = useState<
    Array<{ question: string; answer: string; timestamp: string }>
  >([]);
  const [mediaActive, setMediaActive] = useState(false);
  const [mediaNotice, setMediaNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [completedInfo, setCompletedInfo] = useState<{
    summary: string;
    score: number;
    recordingUrl?: string | null;
  } | null>(
    existingStatus === "COMPLETED" && existingSummary
      ? { summary: existingSummary, score: 88 }
      : null
  );

  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const speakQuestion = (text: string) => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.rate = 0.98;
      window.speechSynthesis.speak(utter);
    }
  };

  useEffect(() => {
    return () => {
      mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const startSession = async () => {
    setStarted(true);
    setStatus("IN_PROGRESS");

    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        mediaStreamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        const recorder = new MediaRecorder(stream);
        chunksRef.current = [];
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunksRef.current.push(e.data);
        };
        recorder.start(1000);
        recorderRef.current = recorder;
        setMediaActive(true);
      } catch {
        setMediaNotice(
          "Camera/Microphone permission unavailable — running in Secure Text & Transcript Interview Mode."
        );
      }
    } else {
      setMediaNotice("Running in Secure Text & Transcript Interview Mode.");
    }

    if (questions[0]) {
      speakQuestion(`Question 1: ${questions[0]}`);
    }
  };

  const handleNextOrFinish = async () => {
    const entry = {
      question: questions[currentIdx],
      answer: answerText.trim() || "(Candidate provided verbal/recorded response)",
      timestamp: new Date().toISOString(),
    };
    const updatedTranscript = [...transcript, entry];
    setTranscript(updatedTranscript);
    setAnswerText("");

    if (currentIdx + 1 < questions.length) {
      const nextIdx = currentIdx + 1;
      setCurrentIdx(nextIdx);
      speakQuestion(`Question ${nextIdx + 1}: ${questions[nextIdx]}`);
      return;
    }

    // Finish & upload recording + transcript
    setSubmitting(true);
    try {
      let recordingBlob: Blob | null = null;
      if (recorderRef.current && recorderRef.current.state !== "inactive") {
        await new Promise<void>((resolve) => {
          recorderRef.current!.onstop = () => resolve();
          recorderRef.current!.stop();
        });
        if (chunksRef.current.length > 0) {
          recordingBlob = new Blob(chunksRef.current, { type: "video/webm" });
        }
      }
      mediaStreamRef.current?.getTracks().forEach((t) => t.stop());

      const fd = new FormData();
      fd.append("transcriptJson", JSON.stringify(updatedTranscript));
      if (recordingBlob) {
        fd.append("recording", recordingBlob, `interview-${token}.webm`);
      }

      const res = await fetch(`/api/interview/${token}`, { method: "POST", body: fd });
      const data = await res.json();
      if (res.ok) {
        setStatus("COMPLETED");
        setCompletedInfo({
          summary: data.interview.aiSummary,
          score: data.interview.overallScore,
          recordingUrl: data.interview.recordingUrl,
        });
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (status === "COMPLETED" && completedInfo) {
    return (
      <div className="mx-auto max-w-2xl rounded-2xl border border-emerald-200 bg-white p-8 shadow-lg text-center space-y-5">
        <div className="mx-auto h-14 w-14 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
          <CheckCircle2 className="h-8 w-8" />
        </div>
        <span className="inline-block rounded-full bg-[#0A192F] px-3.5 py-1 text-xs font-bold text-sky-300">
          AI Interview Score: {completedInfo.score}/100
        </span>
        <h2 className="font-heading text-2xl font-extrabold text-[#0A0F1A]">
          AI Interview Completed &amp; Archived
        </h2>
        <p className="text-sm text-slate-600 leading-relaxed">{completedInfo.summary}</p>
        <div className="pt-3 flex justify-center gap-3">
          <Link
            href="/portal"
            className="rounded-full bg-[#0A192F] px-6 py-2.5 text-xs font-bold text-white hover:bg-[#1E3A8A]"
          >
            Return to Client Portal Pipeline →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl grid grid-cols-1 lg:grid-cols-12 gap-8">
      {/* Left: Video/AI Stage */}
      <div className="lg:col-span-5 space-y-4">
        <div className="rounded-2xl border border-slate-200 bg-[#0A0F1A] text-white overflow-hidden shadow-lg">
          <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between text-xs">
            <span className="inline-flex items-center gap-1.5 font-semibold text-sky-300">
              <Bot className="h-4 w-4" /> Via Codos AI Interviewer
            </span>
            {mediaActive && (
              <span className="inline-flex items-center gap-1 text-rose-400 font-semibold">
                <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" /> REC
              </span>
            )}
          </div>
          <div className="aspect-video bg-[#0A192F] relative flex items-center justify-center">
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className={`h-full w-full object-cover ${mediaActive ? "block" : "hidden"}`}
            />
            {!mediaActive && (
              <div className="text-center p-6 space-y-2">
                <div className="mx-auto h-14 w-14 rounded-full bg-white/10 flex items-center justify-center">
                  <Video className="h-7 w-7 text-sky-300" />
                </div>
                <div className="text-xs text-slate-300">
                  {started
                    ? "Transcript Capture Active"
                    : "Camera & Microphone will initialize when you start"}
                </div>
              </div>
            )}
          </div>
          <div className="p-4 text-xs text-slate-300 space-y-1">
            <div>
              <strong>Profile:</strong> {profileCode} — {roleTitle}
            </div>
            <div>
              <strong>Client Organization:</strong> {companyName}
            </div>
          </div>
        </div>

        {mediaNotice && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            {mediaNotice}
          </div>
        )}
      </div>

      {/* Right: Interactive AI Questions & Response Capture */}
      <div className="lg:col-span-7">
        {!started ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm space-y-5">
            <h2 className="font-heading text-2xl font-bold text-[#0A0F1A]">
              Ready for Your AI Technical &amp; Leadership Interview?
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              The client has selected <strong>{questions.length}</strong> customized question(s) for this session. Both your browser recording (if permitted) and full Q&amp;A transcript will be securely shared with the client in their portal.
            </p>
            <div className="rounded-xl bg-[#F8FAFC] border border-slate-200 p-4 space-y-2">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Session Topics
              </div>
              <ul className="space-y-1.5 text-xs text-slate-700 list-disc list-inside">
                {questions.map((q, i) => (
                  <li key={i}>{q}</li>
                ))}
              </ul>
            </div>
            <button
              type="button"
              onClick={startSession}
              className="inline-flex items-center gap-2 rounded-full bg-[#0A192F] px-6 py-3 text-sm font-bold text-white hover:bg-[#1E3A8A]"
            >
              <Play className="h-4 w-4" />
              Start AI Interview Session
            </button>
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm space-y-5">
            <div className="flex items-center justify-between text-xs font-semibold text-[#1D4ED8]">
              <span>
                Question {currentIdx + 1} of {questions.length}
              </span>
              <button
                type="button"
                onClick={() => speakQuestion(questions[currentIdx])}
                className="inline-flex items-center gap-1 hover:underline"
              >
                <Volume2 className="h-3.5 w-3.5" /> Replay Voice Prompt
              </button>
            </div>

            <div className="rounded-xl bg-[#0A192F] p-5 text-white">
              <p className="font-heading text-lg font-bold leading-snug">
                {questions[currentIdx]}
              </p>
            </div>

            <div>
              <label className="flex items-center justify-between text-xs font-semibold text-[#0A0F1A] mb-1.5">
                <span>Your Response Transcript</span>
                <span className="inline-flex items-center gap-1 text-slate-500 font-normal">
                  <Mic className="h-3 w-3" /> Speak or type your structured answer
                </span>
              </label>
              <textarea
                rows={5}
                value={answerText}
                onChange={(e) => setAnswerText(e.target.value)}
                placeholder="Type or dictate your detailed technical / operational answer here..."
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:border-[#0A192F] focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-slate-500">
                {transcript.length} question(s) answered
              </span>
              <button
                type="button"
                disabled={submitting}
                onClick={handleNextOrFinish}
                className="inline-flex items-center gap-2 rounded-full bg-[#0A192F] px-6 py-3 text-sm font-bold text-white hover:bg-[#1E3A8A] disabled:opacity-50"
              >
                {currentIdx + 1 < questions.length ? (
                  <>
                    Save &amp; Next Question <ArrowRight className="h-4 w-4" />
                  </>
                ) : (
                  <>
                    <Square className="h-3.5 w-3.5" />
                    {submitting ? "Archiving Recording & Transcript..." : "Finish & Submit Interview"}
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

