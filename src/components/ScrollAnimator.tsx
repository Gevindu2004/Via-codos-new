"use client";

import React, { useEffect, useRef, useState } from "react";
import { ArrowUp } from "lucide-react";

interface RevealProps {
  children: React.ReactNode;
  delay?: number;
  direction?: "up" | "down" | "left" | "right" | "scale" | "none";
  duration?: number;
  className?: string;
}

/**
 * Bidirectional IntersectionObserver scroll-reveal wrapper.
 * Animates smoothly when scrolling DOWN into view and also re-animates cleanly when scrolling UP!
 */
export function Reveal({
  children,
  delay = 0,
  direction = "up",
  duration = 620,
  className = "",
}: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [exitSide, setExitSide] = useState<"above" | "below">("below");

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setVisible(true);
      return;
    }

    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true);
          } else {
            // Track whether element exited above (will re-enter on scroll UP) or below (scroll DOWN)
            setExitSide(entry.boundingClientRect.top < 0 ? "above" : "below");
            setVisible(false);
          }
        }
      },
      { threshold: 0.05, rootMargin: "0px 0px -12px 0px" }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  let hiddenTransform = "none";
  if (direction === "up") {
    hiddenTransform =
      exitSide === "above" ? "translate3d(0, -24px, 0)" : "translate3d(0, 24px, 0)";
  } else if (direction === "down") {
    hiddenTransform =
      exitSide === "above" ? "translate3d(0, -24px, 0)" : "translate3d(0, 24px, 0)";
  } else if (direction === "left") {
    hiddenTransform = "translate3d(28px, 0, 0)";
  } else if (direction === "right") {
    hiddenTransform = "translate3d(-28px, 0, 0)";
  } else if (direction === "scale") {
    hiddenTransform = "scale(0.95)";
  }

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translate3d(0, 0, 0) scale(1)" : hiddenTransform,
        transitionProperty: "opacity, transform",
        transitionDuration: `${duration}ms`,
        transitionDelay: visible ? `${delay}ms` : "0ms",
        transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)",
        willChange: "opacity, transform",
      }}
    >
      {children}
    </div>
  );
}

/**
 * Bidirectional count-up stat: animates from 0 to target whenever scrolled into view (both scroll down & scroll up).
 */
export function CountUpStat({
  end,
  endSecondary,
  separator = "–",
  prefix = "",
  suffix = "",
  duration = 1400,
}: {
  end: number;
  endSecondary?: number;
  separator?: string;
  prefix?: string;
  suffix?: string;
  duration?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [val, setVal] = useState(0);
  const [val2, setVal2] = useState(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setVal(end);
      if (endSecondary !== undefined) setVal2(endSecondary);
      return;
    }

    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        if (entry.isIntersecting) {
          cancelAnimationFrame(rafRef.current);
          const start = performance.now();
          const tick = (now: number) => {
            const t = Math.min(1, (now - start) / duration);
            const eased = 1 - Math.pow(1 - t, 3);
            setVal(Math.round(end * eased));
            if (endSecondary !== undefined) {
              setVal2(Math.round(endSecondary * eased));
            }
            if (t < 1) {
              rafRef.current = requestAnimationFrame(tick);
            }
          };
          rafRef.current = requestAnimationFrame(tick);
        } else {
          cancelAnimationFrame(rafRef.current);
          setVal(0);
          if (endSecondary !== undefined) setVal2(0);
        }
      },
      { threshold: 0.35 }
    );

    observer.observe(el);
    return () => {
      cancelAnimationFrame(rafRef.current);
      observer.disconnect();
    };
  }, [end, endSecondary, duration]);

  return (
    <span ref={ref} className="tabular-nums">
      {prefix}
      {val}
      {endSecondary !== undefined ? `${separator}${val2}` : ""}
      {suffix}
    </span>
  );
}

/**
 * Floating Back-to-Top control that appears smoothly on scroll and scrolls back up gracefully.
 */
export function BackToTopButton() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setShow(window.scrollY > 360);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <button
      type="button"
      aria-label="Scroll back to top"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className={`fixed bottom-6 right-6 z-40 inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-[#0A192F] text-white shadow-xl shadow-[#0A192F]/30 transition-all duration-300 hover:bg-[#1E3A8A] hover:-translate-y-1 ${
        show
          ? "opacity-100 translate-y-0 pointer-events-auto"
          : "opacity-0 translate-y-4 pointer-events-none"
      }`}
    >
      <ArrowUp className="h-4 w-4" />
    </button>
  );
}
