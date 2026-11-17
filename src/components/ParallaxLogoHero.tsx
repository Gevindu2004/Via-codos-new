"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, ShieldCheck, Cpu, Users, Globe } from "lucide-react";
import { ViaCodosMark } from "./ViaCodosLogo";

interface CalloutItem {
  label: string;
  detail: string;
}

interface HeroProps {
  badge?: string;
  eyebrow?: string;
  headline?: string;
  subheadline?: string;
  primaryCtaLabel?: string;
  primaryCtaHref?: string;
  secondaryCtaLabel?: string;
  secondaryCtaHref?: string;
  callouts?: CalloutItem[];
}

const PILLARS = [
  {
    id: "talent",
    dotColor: "#0A192F",
    title: "Top 1% Vetted Bench",
    caption: "40+ IT, Legacy & Management Profiles",
    href: "/talent",
  },
  {
    id: "console",
    dotColor: "#1D4ED8",
    title: "Codos Console SaaS",
    caption: "Skybeak · Thumbs Up APIs · Call Colleague",
    href: "/codos-console",
  },
  {
    id: "governance",
    dotColor: "#0284C7",
    title: "NDA-First & E-Sign",
    caption: "PDF-Stamped Agreements & Audit Trail",
    href: "/legal",
  },
];

export function ParallaxLogoHero({
  badge = "GLOBAL IT & SAAS ECOSYSTEM • 2025",
  eyebrow = "Enterprise Engineering · Staff Augmentation · Codos Console",
  headline = "Precision Engineering & Global Talent, Delivered.",
  subheadline = "Scale with vetted IT, legacy mainframe, and management specialists alongside our Codos Console SaaS suite — built on NDA-first governance and 40–70% cost efficiency.",
  primaryCtaLabel = "Request Talent or Consultation",
  primaryCtaHref = "/staff-augmentation/request",
  secondaryCtaLabel = "Explore Codos Console",
  secondaryCtaHref = "/codos-console",
  callouts = [
    { label: "Top 1% Vetted Bench", detail: "IT, Legacy COBOL/AS400 & Management" },
    { label: "Codos Console SaaS", detail: "Skybeak · Thumbs Up APIs · Call Colleague" },
    { label: "NDA-First & E-Sign", detail: "Instant Stamped PDF Governance" },
  ],
}: HeroProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ rx: 6, ry: -8, tx: 0, ty: 0 });
  const [scrollOffset, setScrollOffset] = useState(0);
  const [activePillar, setActivePillar] = useState(0);
  const [isPillarPaused, setIsPillarPaused] = useState(false);

  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        setScrollOffset(Math.min(window.scrollY, 600));
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  useEffect(() => {
    if (isPillarPaused || typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const timer = window.setInterval(() => {
      setActivePillar((prev) => (prev + 1) % PILLARS.length);
    }, 3500);

    return () => window.clearInterval(timer);
  }, [isPillarPaused, activePillar]);

  const handleMouseMove = (e: React.MouseEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const nx = (e.clientX - rect.left) / rect.width - 0.5;
    const ny = (e.clientY - rect.top) / rect.height - 0.5;
    setTilt({
      rx: -ny * 18,
      ry: nx * 22,
      tx: nx * 16,
      ty: ny * 12,
    });
  };

  const handleMouseLeave = () => {
    setTilt({ rx: 6, ry: -8, tx: 0, ty: 0 });
  };

  const c1 = callouts[0] || { label: "Top 1% Vetted Bench", detail: "IT & Management" };
  const c2 = callouts[1] || { label: "Codos Console SaaS", detail: "Unified Cloud Suite" };
  const c3 = callouts[2] || { label: "NDA-First & E-Sign", detail: "Audit-Ready Contracts" };

  return (
    <section
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="relative overflow-hidden bg-white border-b border-slate-200 min-h-[calc(100vh-58px)] flex flex-col justify-center py-5 sm:py-6 lg:py-7"
    >
      {/* Architectural Concentric Rings Background (White + subtle Navy blueprint grid) */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden">
        <div
          className="h-[460px] w-[460px] md:h-[660px] md:w-[660px] rounded-full border border-slate-200/80 transition-transform duration-150 ease-out"
          style={{ transform: `translateY(${scrollOffset * 0.14}px) scale(${1 + scrollOffset * 0.0003})` }}
        />
        <div
          className="absolute h-[330px] w-[330px] md:h-[490px] md:w-[490px] rounded-full border border-slate-200/90 transition-transform duration-150 ease-out"
          style={{ transform: `translateY(${scrollOffset * 0.09}px) scale(${1 + scrollOffset * 0.0002})` }}
        />
        <div
          className="absolute h-[210px] w-[210px] md:h-[320px] md:w-[320px] rounded-full border border-[#0A192F]/10 bg-[radial-gradient(circle_at_center,rgba(29,78,216,0.05),transparent_70%)] transition-transform duration-150 ease-out"
          style={{ transform: `translateY(${scrollOffset * 0.05}px)` }}
        />
        <div
          className="absolute inset-0 opacity-[0.3]"
          style={{
            backgroundImage: "radial-gradient(#cbd5e1 1px, transparent 1px)",
            backgroundSize: "26px 26px",
          }}
        />
      </div>

      {/* Rotating Circular Seal (Top-Left like reference) */}
      <div className="hidden lg:flex absolute top-5 left-8 xl:left-16 items-center justify-center w-20 h-20">
        <svg viewBox="0 0 120 120" className="w-20 h-20 animate-slow-spin text-[#0A192F]/70">
          <defs>
            <path
              id="vcSealPath"
              d="M 60, 60 m -44, 0 a 44,44 0 1,1 88,0 a 44,44 0 1,1 -88,0"
            />
          </defs>
          <text className="fill-current text-[10px] font-semibold tracking-[0.22em] uppercase">
            <textPath href="#vcSealPath">{badge} • </textPath>
          </text>
        </svg>
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <img
            src="/assets/logo.png"
            alt="Via Codos VC Seal"
            className="h-7 w-7 object-contain"
          />
        </div>
      </div>

      <div
        className="relative z-10 mx-auto max-w-7xl w-full px-4 sm:px-6 lg:px-8"
        style={{
          opacity: scrollOffset > 0 ? Math.max(0.25, 1 - scrollOffset / 650) : 1,
          transform: scrollOffset > 0 ? `translateY(${scrollOffset * -0.05}px)` : "translateY(0)",
        }}
      >
        {/* Compact Centered Enterprise Headline Block */}
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-[#0A192F]/15 bg-[#0A192F] px-3 py-0.5 text-[10px] font-semibold tracking-[0.14em] uppercase text-white shadow-sm">
            {eyebrow}
          </span>

          <h1 className="font-heading mt-3 text-3xl font-extrabold tracking-tight text-[#0A0F1A] sm:text-4xl lg:text-[2.75rem] leading-[1.06]">
            {headline}
          </h1>

          <p className="mx-auto mt-2.5 max-w-2xl text-sm sm:text-[15px] text-slate-600 leading-snug">
            {subheadline}
          </p>

          {/* Primary & Secondary CTAs */}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
            <Link
              href={primaryCtaHref}
              className="inline-flex items-center gap-2 rounded-full bg-[#0A192F] px-5 py-2.5 text-xs sm:text-sm font-semibold text-white shadow-md shadow-[#0A192F]/20 transition hover:bg-[#1E3A8A]"
            >
              {primaryCtaLabel}
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href={secondaryCtaHref}
              className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-5 py-2.5 text-xs sm:text-sm font-semibold text-[#0A0F1A] shadow-sm transition hover:border-[#0A192F] hover:bg-slate-50"
            >
              {secondaryCtaLabel}
              <ArrowRight className="h-4 w-4 text-[#1D4ED8]" />
            </Link>
          </div>

          {/* Trust metric bar */}
          <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] font-medium text-slate-600">
            <span className="inline-flex items-center gap-1 text-[#0A192F] font-semibold">
              <ShieldCheck className="h-3.5 w-3.5 text-[#1D4ED8]" />
              500+ Enterprise Projects Delivered
            </span>
            <span className="text-slate-300">•</span>
            <span>200+ Global Clients</span>
            <span className="text-slate-300">•</span>
            <span>40–70% Cost Efficiency</span>
          </div>
        </div>

        {/* Central 3D Parallax Logo Stage + Callout Pins (sized to fit cleanly in 1 frame!) */}
        <div
          ref={stageRef}
          className="relative mx-auto mt-4 max-w-4xl flex flex-col items-center justify-center py-2 sm:py-3"
          style={{ perspective: "1200px" }}
        >
          {/* Floating Callout Pin 1 (Left-Top) */}
          <Link
            href="/talent"
            className="hidden md:flex items-center gap-2 absolute left-4 lg:left-10 top-4 z-20 rounded-full border border-slate-200 bg-white/95 backdrop-blur px-3.5 py-1.5 shadow-md shadow-slate-900/5 transition hover:-translate-y-0.5 hover:border-[#1D4ED8]"
            style={{
              transform: `translate3d(${tilt.tx * -0.45 - scrollOffset * 0.05}px, ${tilt.ty * -0.45 - scrollOffset * 0.08}px, 30px)`,
            }}
          >
            <span className="h-2 w-2 rounded-full bg-[#1D4ED8]" />
            <span className="text-left">
              <span className="block text-[11px] font-bold text-[#0A0F1A] leading-tight">
                {c1.label}
              </span>
              <span className="block text-[9.5px] text-slate-500 leading-tight">{c1.detail}</span>
            </span>
          </Link>
          <div className="hidden md:block absolute left-56 top-10 w-24 h-px bg-gradient-to-r from-slate-300 to-[#0A192F]/40 rotate-[16deg] origin-left pointer-events-none" />

          {/* Floating Callout Pin 2 (Right-Top) */}
          <Link
            href="/codos-console"
            className="hidden md:flex items-center gap-2 absolute right-4 lg:right-10 top-3 z-20 rounded-full border border-slate-200 bg-white/95 backdrop-blur px-3.5 py-1.5 shadow-md shadow-slate-900/5 transition hover:-translate-y-0.5 hover:border-[#1D4ED8]"
            style={{
              transform: `translate3d(${tilt.tx * 0.5 + scrollOffset * 0.05}px, ${tilt.ty * -0.4 - scrollOffset * 0.08}px, 30px)`,
            }}
          >
            <span className="h-2 w-2 rounded-full bg-[#0A192F]" />
            <span className="text-left">
              <span className="block text-[11px] font-bold text-[#0A0F1A] leading-tight">
                {c2.label}
              </span>
              <span className="block text-[9.5px] text-slate-500 leading-tight">{c2.detail}</span>
            </span>
          </Link>
          <div className="hidden md:block absolute right-56 top-9 w-24 h-px bg-gradient-to-l from-slate-300 to-[#0A192F]/40 -rotate-[16deg] origin-right pointer-events-none" />

          {/* Floating Callout Pin 3 (Right-Bottom) */}
          <Link
            href="/legal"
            className="hidden md:flex items-center gap-2 absolute right-6 lg:right-14 bottom-12 z-20 rounded-full border border-slate-200 bg-white/95 backdrop-blur px-3.5 py-1.5 shadow-md shadow-slate-900/5 transition hover:-translate-y-0.5 hover:border-[#1D4ED8]"
            style={{
              transform: `translate3d(${tilt.tx * 0.55 + scrollOffset * 0.04}px, ${tilt.ty * 0.45 + scrollOffset * 0.06}px, 30px)`,
            }}
          >
            <span className="h-2 w-2 rounded-full bg-[#0284C7]" />
            <span className="text-left">
              <span className="block text-[11px] font-bold text-[#0A0F1A] leading-tight">
                {c3.label}
              </span>
              <span className="block text-[9.5px] text-slate-500 leading-tight">{c3.detail}</span>
            </span>
          </Link>
          <div className="hidden md:block absolute right-60 bottom-16 w-20 h-px bg-gradient-to-l from-slate-300 to-[#0A192F]/40 rotate-[14deg] origin-right pointer-events-none" />

          {/* 3D Interactive Parallax Floating Via Codos Logo + Wordmark (No Box) */}
          <div
            className="relative transition-transform duration-200 ease-out py-3 px-6"
            style={{
              transformStyle: "preserve-3d",
              transform: `rotateX(${tilt.rx + scrollOffset * 0.03}deg) rotateY(${tilt.ry - scrollOffset * 0.02}deg) translateY(${-scrollOffset * 0.12}px) scale(${Math.max(0.92, 1 - scrollOffset * 0.00018)})`,
            }}
          >
            {/* Subtle soft floor shadow */}
            <div
              className="absolute -bottom-3 left-1/2 -translate-x-1/2 h-5 w-44 rounded-full bg-[#0A192F]/15 blur-lg pointer-events-none"
              style={{ transform: "translateZ(-40px)" }}
            />

            <div
              className="relative flex flex-col items-center"
              style={{ transform: "translateZ(36px)" }}
            >
              <ViaCodosMark
                size={112}
                className="drop-shadow-[0_14px_18px_rgba(10,25,47,0.18)]"
              />
              <div className="mt-2.5 flex flex-col items-center">
                <span className="font-heading text-2xl sm:text-3xl font-extrabold tracking-tight text-[#0A192F] leading-none">
                  Via Codos
                </span>
                <div className="mt-1.5 flex items-center gap-2">
                  <span className="h-px w-6 bg-[#1D4ED8]/55" />
                  <span className="text-[10px] font-bold tracking-[0.28em] uppercase text-[#1E3A8A]">
                    (PVT) LTD
                  </span>
                  <span className="h-px w-6 bg-[#1D4ED8]/55" />
                </div>
              </div>
            </div>
          </div>

          {/* Mobile Callout Pills */}
          <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-2 w-full md:hidden">
            {[
              { icon: Users, item: c1, href: "/talent" },
              { icon: Cpu, item: c2, href: "/codos-console" },
              { icon: Globe, item: c3, href: "/legal" },
            ].map(({ icon: Icon, item, href }) => (
              <Link
                key={item.label}
                href={href}
                className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm"
              >
                <Icon className="h-4 w-4 text-[#1D4ED8] shrink-0" />
                <div>
                  <div className="text-[11px] font-bold text-[#0A0F1A]">{item.label}</div>
                  <div className="text-[9.5px] text-slate-500">{item.detail}</div>
                </div>
              </Link>
            ))}
          </div>

          {/* Interactive Pillar Selector Dots */}
          <div
            className="mt-5 flex flex-col items-center gap-1.5"
            onMouseEnter={() => setIsPillarPaused(true)}
            onMouseLeave={() => setIsPillarPaused(false)}
          >
            <div className="flex items-center gap-2.5">
              {PILLARS.map((p, idx) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setActivePillar(idx)}
                  aria-label={p.title}
                  className={`h-3 w-3 rounded-full transition-all duration-300 ${
                    activePillar === idx
                      ? "ring-2 ring-offset-2 ring-[#0A192F] scale-110"
                      : "opacity-55 hover:opacity-90"
                  }`}
                  style={{ backgroundColor: p.dotColor }}
                />
              ))}
            </div>
            <Link
              key={PILLARS[activePillar].id}
              href={PILLARS[activePillar].href}
              className="animate-pillar-slide text-[11px] font-semibold text-[#0A192F] hover:text-[#1D4ED8] transition inline-flex items-center gap-1"
            >
              <span>{PILLARS[activePillar].title}</span>
              <span className="text-slate-400">—</span>
              <span className="text-slate-600 font-normal">{PILLARS[activePillar].caption}</span>
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
