"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FileSignature,
  MessageSquare,
  ShieldCheck,
  Users,
  Video,
} from "lucide-react";

interface WorkflowStage {
  step: number;
  name: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
}

const ROW_TOP: WorkflowStage[] = [
  { step: 1, name: "Requested", desc: "Shortlist specialist from bench", icon: Users },
  { step: 2, name: "Approved", desc: "Admin releases full dossier", icon: ShieldCheck },
  { step: 3, name: "Interview", desc: "AI interview & transcript", icon: MessageSquare },
];

// Stored in logical progression order (4 -> 5 -> 6) for mobile stacking;
// desktop CSS grid order reverses them (6 <- 5 <- 4) so Stage 4 sits directly below Stage 3.
const ROW_BOTTOM: WorkflowStage[] = [
  { step: 4, name: "Meeting", desc: "3-way Codos Mgmt call", icon: Video },
  { step: 5, name: "Contract", desc: "E-Sign stamped PDF", icon: FileSignature },
  { step: 6, name: "Hired / Placed", desc: "Profile marked Placed", icon: CheckCircle2 },
];

const DESKTOP_ORDER_CLASS: Record<number, string> = {
  4: "sm:order-3",
  5: "sm:order-2",
  6: "sm:order-1",
};

// Step progression timings (ms) after entering viewport: 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7 (green highlight)
const STEP_DELAYS = [150, 530, 910, 1290, 1670, 2050, 2750];

export function HiringWorkflowDiagram() {
  const containerRef = useRef<HTMLDivElement>(null);
  // phase 0 = hidden; 1..6 = stages revealed one by one; 7 = stage 6 confirmed green highlight + check
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setPhase(7);
      return;
    }

    const el = containerRef.current;
    if (!el) return;

    let timers: number[] = [];
    const clearAll = () => {
      timers.forEach((id) => window.clearTimeout(id));
      timers = [];
    };

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        clearAll();

        if (entry.isIntersecting) {
          setPhase(0);
          timers = STEP_DELAYS.map((delay, idx) =>
            window.setTimeout(() => setPhase(idx + 1), delay)
          );
        } else {
          setPhase(0);
        }
      },
      { threshold: 0.18 }
    );

    observer.observe(el);
    return () => {
      clearAll();
      observer.disconnect();
    };
  }, []);

  const stage6Highlighted = phase >= 7;

  const renderCard = (node: WorkflowStage) => {
    const Icon = node.icon;
    const isVisible = phase >= node.step;
    const isCurrentlyActive = phase === node.step && !(node.step === 6 && stage6Highlighted);
    const isFinalGreen = node.step === 6 && stage6Highlighted;

    return (
      <div className="relative h-full">
        {isFinalGreen && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 rounded-xl border-2 border-emerald-400 animate-placed-ring"
          />
        )}
        <div
          className={`relative h-full rounded-xl border p-3.5 transition-all duration-700 ease-out ${
            isVisible
              ? "opacity-100 translate-y-0 scale-100"
              : "opacity-0 translate-y-3 scale-95"
          } ${
            isFinalGreen
              ? "animate-placed-card border-emerald-500 bg-emerald-50/90 ring-2 ring-emerald-500/20 shadow-[0_6px_22px_rgba(16,185,129,0.18)]"
              : isCurrentlyActive
                ? "border-[#1D4ED8] bg-white ring-2 ring-[#1D4ED8]/15 shadow-[0_4px_14px_rgba(29,78,216,0.12)]"
                : "border-slate-200 bg-white shadow-[0_2px_8px_rgba(10,25,47,0.04)] hover:border-[#1D4ED8]/50 hover:shadow-md"
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span
              className={`inline-flex h-5 w-5 items-center justify-center rounded-md text-[10px] font-bold transition-colors duration-500 ${
                isFinalGreen
                  ? "bg-emerald-600 text-white"
                  : isCurrentlyActive
                    ? "bg-[#1D4ED8] text-white"
                    : "bg-[#0A192F] text-white"
              }`}
            >
              {isFinalGreen ? (
                <svg viewBox="0 0 16 16" fill="none" className="h-3 w-3" aria-hidden="true">
                  <path
                    d="M3.5 8.5L6.5 11.5L12.5 4.5"
                    stroke="currentColor"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="animate-check-draw"
                  />
                </svg>
              ) : (
                node.step
              )}
            </span>

            {node.step === 6 ? (
              <div className="relative flex items-center justify-end min-h-[20px]">
                <Icon
                  className={`h-3.5 w-3.5 transition-all duration-400 ${
                    isFinalGreen
                      ? "opacity-0 scale-75 absolute right-0"
                      : isCurrentlyActive
                        ? "opacity-100 scale-100 text-[#1D4ED8]"
                        : "opacity-100 scale-100 text-slate-400"
                  }`}
                />
                <span
                  className={`inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white shadow-xs transition-all duration-500 ${
                    isFinalGreen
                      ? "opacity-100 translate-x-0 scale-100"
                      : "opacity-0 translate-x-2 scale-90 pointer-events-none"
                  }`}
                >
                  <svg viewBox="0 0 16 16" fill="none" className="h-2.5 w-2.5" aria-hidden="true">
                    <path
                      d="M3.5 8.5L6.5 11.5L12.5 4.5"
                      stroke="currentColor"
                      strokeWidth="2.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className={isFinalGreen ? "animate-check-draw" : ""}
                    />
                  </svg>
                  Placed
                </span>
              </div>
            ) : (
              <Icon
                className={`h-3.5 w-3.5 transition-colors duration-500 ${
                  isCurrentlyActive ? "text-[#1D4ED8]" : "text-slate-400"
                }`}
              />
            )}
          </div>

          <div
            className={`font-heading text-[13px] font-bold mt-2 transition-colors duration-500 ${
              isFinalGreen ? "text-emerald-950" : "text-[#0A0F1A]"
            }`}
          >
            {node.name}
          </div>
          <div
            className={`text-[11px] mt-0.5 leading-snug transition-colors duration-500 ${
              isFinalGreen ? "text-emerald-800" : "text-slate-500"
            }`}
          >
            {node.desc}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div
      ref={containerRef}
      className="rounded-2xl border border-slate-200/90 bg-[#F8FAFC] p-5 sm:p-6 shadow-[0_8px_30px_rgb(10,25,47,0.05)]"
    >
      <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-200/80">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#1D4ED8]">
            6-Stage Hiring Governance Pipeline
          </div>
          <h3 className="font-heading text-lg font-bold text-[#0A0F1A] mt-0.5 tracking-tight">
            From Anonymized Discovery to Placed
          </h3>
        </div>
        <span className="shrink-0 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 shadow-2xs">
          Workflow
        </span>
      </div>

      {/* Dotted Workflow Canvas */}
      <div
        className="mt-4 rounded-xl border border-slate-200/80 bg-white/75 p-4"
        style={{
          backgroundImage: "radial-gradient(#CBD5E1 1px, transparent 1px)",
          backgroundSize: "16px 16px",
        }}
      >
        {/* Row 1: 1 -> 2 -> 3 (left to right) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-5">
          {ROW_TOP.map((node, idx) => (
            <div key={node.step} className="relative flex flex-col">
              {renderCard(node)}

              {/* Desktop rightward connector (between 1->2 and 2->3) */}
              {idx < ROW_TOP.length - 1 && (
                <div
                  aria-hidden="true"
                  className={`hidden sm:flex items-center absolute top-1/2 -right-5 w-5 -translate-y-1/2 z-10 justify-center transition-opacity duration-300 ${
                    phase >= node.step + 1 ? "opacity-100" : "opacity-20"
                  }`}
                >
                  <div
                    className={`h-[1.5px] w-full transition-colors duration-300 ${
                      phase >= node.step + 1 ? "bg-[#1D4ED8]/60" : "bg-slate-300"
                    }`}
                  />
                  <ChevronRight
                    className={`h-3.5 w-3.5 -ml-1.5 shrink-0 transition-colors duration-300 ${
                      phase >= node.step + 1 ? "text-[#1D4ED8]" : "text-slate-400"
                    }`}
                  />
                </div>
              )}

              {/* Mobile downward connector */}
              <div
                aria-hidden="true"
                className={`flex sm:hidden justify-center py-1 transition-opacity duration-300 ${
                  phase >= node.step + 1 ? "text-[#1D4ED8] opacity-100" : "text-slate-300 opacity-40"
                }`}
              >
                <ChevronDown className="h-4 w-4" />
              </div>
            </div>
          ))}
        </div>

        {/* Desktop Turn Connector: directly below Stage 3 -> into Stage 4 on the right column */}
        <div aria-hidden="true" className="hidden sm:grid grid-cols-3 gap-5 h-7">
          <div />
          <div />
          <div
            className={`flex flex-col items-center justify-center transition-opacity duration-300 ${
              phase >= 4 ? "opacity-100" : "opacity-25"
            }`}
          >
            <div
              className={`w-[1.5px] h-3.5 transition-colors duration-300 ${
                phase >= 4 ? "bg-[#1D4ED8]/60" : "bg-slate-300"
              }`}
            />
            <ChevronDown
              className={`h-3.5 w-3.5 -mt-1.5 transition-colors duration-300 ${
                phase >= 4 ? "text-[#1D4ED8]" : "text-slate-400"
              }`}
            />
          </div>
        </div>

        {/* Row 2: 6 <- 5 <- 4 on desktop (right to left), 4 -> 5 -> 6 on mobile */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-5">
          {ROW_BOTTOM.map((node) => {
            const hasLeftwardConnector = node.step === 4 || node.step === 5;
            const nextStepActive = phase >= node.step + 1;
            const finalGreenConnector = node.step === 5 && stage6Highlighted;

            return (
              <div
                key={node.step}
                className={`relative flex flex-col ${DESKTOP_ORDER_CLASS[node.step] ?? ""}`}
              >
                {renderCard(node)}

                {/* Desktop leftward connector (4 -> 5 and 5 -> 6) */}
                {hasLeftwardConnector && (
                  <div
                    aria-hidden="true"
                    className={`hidden sm:flex items-center absolute top-1/2 -left-5 w-5 -translate-y-1/2 z-10 justify-center transition-opacity duration-300 ${
                      nextStepActive ? "opacity-100" : "opacity-20"
                    }`}
                  >
                    <ChevronLeft
                      className={`h-3.5 w-3.5 -mr-1.5 shrink-0 transition-colors duration-300 ${
                        finalGreenConnector
                          ? "text-emerald-600"
                          : nextStepActive
                            ? "text-[#1D4ED8]"
                            : "text-slate-400"
                      }`}
                    />
                    <div
                      className={`h-[1.5px] w-full transition-colors duration-300 ${
                        finalGreenConnector
                          ? "bg-emerald-500"
                          : nextStepActive
                            ? "bg-[#1D4ED8]/60"
                            : "bg-slate-300"
                      }`}
                    />
                  </div>
                )}

                {/* Mobile downward connector (between 4->5 and 5->6) */}
                {node.step < 6 && (
                  <div
                    aria-hidden="true"
                    className={`flex sm:hidden justify-center py-1 transition-opacity duration-300 ${
                      nextStepActive ? "text-[#1D4ED8] opacity-100" : "text-slate-300 opacity-40"
                    }`}
                  >
                    <ChevronDown className="h-4 w-4" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between px-1 text-xs">
        <span className="inline-flex items-center gap-1.5 font-medium text-slate-500">
          <ShieldCheck className="h-3.5 w-3.5 text-slate-400" />
          Verified Client Portal Access
        </span>
        <Link
          href="/portal"
          className="inline-flex items-center gap-1 font-semibold text-[#1D4ED8] hover:text-[#0A192F] transition-colors"
        >
          Open Client Portal
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}

