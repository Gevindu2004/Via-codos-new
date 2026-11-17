"use client";

import React, { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

const MIN_VISIBLE_MS = 550;
const MAX_WAIT_MS = 8000;
const FADE_OUT_MS = 280;

function NavigationLoaderInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const routeKey = `${pathname}?${searchParams?.toString() ?? ""}`;

  const [mounted, setMounted] = useState(false);
  const [fadingOut, setFadingOut] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const offscreenRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number>(0);

  const activeRef = useRef(false);
  const shownAtRef = useRef(0);
  const prevRouteRef = useRef(routeKey);
  const hideTimerRef = useRef<number | null>(null);
  const maxTimerRef = useRef<number | null>(null);

  const clearTimers = useCallback(() => {
    if (hideTimerRef.current !== null) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
    if (maxTimerRef.current !== null) {
      window.clearTimeout(maxTimerRef.current);
      maxTimerRef.current = null;
    }
  }, []);

  const hideOverlay = useCallback(() => {
    if (!activeRef.current) return;
    const elapsed = Date.now() - shownAtRef.current;
    const remaining = Math.max(0, MIN_VISIBLE_MS - elapsed);

    clearTimers();
    hideTimerRef.current = window.setTimeout(() => {
      setFadingOut(true);
      hideTimerRef.current = window.setTimeout(() => {
        activeRef.current = false;
        setMounted(false);
        setFadingOut(false);
        const video = videoRef.current;
        if (video) {
          video.pause();
        }
      }, FADE_OUT_MS);
    }, remaining);
  }, [clearTimers]);

  const showOverlay = useCallback(() => {
    clearTimers();
    shownAtRef.current = Date.now();
    activeRef.current = true;
    setFadingOut(false);
    setMounted(true);

    const video = videoRef.current;
    if (video) {
      try {
        video.currentTime = 0;
        void video.play();
      } catch {
        // Ignore autoplay restrictions
      }
    }

    // Safety guard so overlay never remains open if navigation cancels or redirects externally
    maxTimerRef.current = window.setTimeout(() => {
      hideOverlay();
    }, MAX_WAIT_MS);
  }, [clearTimers, hideOverlay]);

  // Listen to internal Next.js <Link>/<a> clicks and browser back/forward navigation
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      const target = e.target as Element | null;
      const anchor = target?.closest("a");
      if (!anchor) return;
      if (anchor.hasAttribute("download")) return;

      const targetAttr = anchor.getAttribute("target");
      if (targetAttr && targetAttr !== "_self") return;

      const rawHref = anchor.getAttribute("href");
      if (
        !rawHref ||
        rawHref.startsWith("#") ||
        rawHref.startsWith("mailto:") ||
        rawHref.startsWith("tel:") ||
        rawHref.startsWith("javascript:")
      ) {
        return;
      }

      try {
        const dest = new URL(anchor.href, window.location.href);
        if (dest.origin !== window.location.origin) return;

        // Skip pure same-route hash jumps
        if (
          dest.pathname === window.location.pathname &&
          dest.search === window.location.search
        ) {
          return;
        }

        showOverlay();
      } catch {
        // Ignore invalid URLs
      }
    };

    const handlePopState = () => {
      showOverlay();
    };

    document.addEventListener("click", handleClick, true);
    window.addEventListener("popstate", handlePopState);
    return () => {
      document.removeEventListener("click", handleClick, true);
      window.removeEventListener("popstate", handlePopState);
    };
  }, [showOverlay]);

  // Hide once destination route commits
  useEffect(() => {
    if (prevRouteRef.current !== routeKey) {
      prevRouteRef.current = routeKey;
      hideOverlay();
    }
  }, [routeKey, hideOverlay]);

  // Clean up timers on unmount
  useEffect(() => clearTimers, [clearTimers]);

  // Key out the light grey/white studio background from loding.mp4 onto a transparent canvas
  useEffect(() => {
    if (!mounted) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    if (!offscreenRef.current) {
      offscreenRef.current = document.createElement("canvas");
    }
    const offscreen = offscreenRef.current;
    const offCtx = offscreen.getContext("2d", { willReadFrequently: true });
    if (!offCtx) return;

    const width = 320;
    const height = 240;
    canvas.width = width;
    canvas.height = height;
    offscreen.width = width;
    offscreen.height = height;

    const renderFrame = () => {
      if (!activeRef.current) return;

      if (video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) {
        // Slightly crop horizontal margins to center tightly on the animated V logo
        const vw = video.videoWidth;
        const vh = video.videoHeight;
        const sx = vw * 0.16;
        const sw = vw * 0.68;
        const sy = vh * 0.06;
        const sh = vh * 0.88;

        offCtx.clearRect(0, 0, width, height);
        offCtx.drawImage(video, sx, sy, sw, sh, 0, 0, width, height);

        const frame = offCtx.getImageData(0, 0, width, height);
        const data = frame.data;

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const max = r > g ? (r > b ? r : b) : g > b ? g : b;
          const min = r < g ? (r < b ? r : b) : g < b ? g : b;
          const sat = max - min;
          const lum = (r + g + b) / 3;

          if (lum > 145 && sat < 28) {
            const lumFactor = Math.min(1, Math.max(0, (lum - 145) / 38));
            const satFactor = Math.min(1, Math.max(0, 1 - (sat - 10) / 18));
            data[i + 3] = Math.round(data[i + 3] * (1 - lumFactor * satFactor));
          }
        }

        ctx.putImageData(frame, 0, 0);
      }

      rafRef.current = window.requestAnimationFrame(renderFrame);
    };

    if (video.paused) {
      void video.play().catch(() => {});
    }
    rafRef.current = window.requestAnimationFrame(renderFrame);

    return () => {
      window.cancelAnimationFrame(rafRef.current);
    };
  }, [mounted]);

  return (
    <>
      {/* Keep hidden preloaded video element ready for instant zero-lag playback */}
      <video
        ref={videoRef}
        src="/assets/loding.mp4"
        muted
        loop
        playsInline
        preload="auto"
        aria-hidden="true"
        className="pointer-events-none fixed -top-[9999px] -left-[9999px] h-1 w-1 opacity-0"
      />

      {mounted && (
        <div
          role="status"
          aria-live="polite"
          aria-label="Loading section"
          className={`fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/30 backdrop-blur-[3px] pointer-events-auto transition-opacity duration-300 ${
            fadingOut ? "opacity-0" : "opacity-100"
          }`}
        >
          <div className="flex flex-col items-center justify-center">
            <canvas
              ref={canvasRef}
              className="w-24 sm:w-28 h-auto drop-shadow-[0_8px_20px_rgba(2,132,199,0.35)]"
            />
            <div className="mt-2 inline-flex items-baseline gap-1 text-xs font-semibold tracking-[0.18em] uppercase text-white drop-shadow-[0_2px_8px_rgba(10,15,26,0.65)]">
              <span>Loading</span>
              <span className="inline-flex items-center gap-0.5" aria-hidden="true">
                <span className="h-1 w-1 rounded-full bg-sky-300 animate-loading-dot" />
                <span className="h-1 w-1 rounded-full bg-sky-300 animate-loading-dot [animation-delay:180ms]" />
                <span className="h-1 w-1 rounded-full bg-sky-300 animate-loading-dot [animation-delay:360ms]" />
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function NavigationLoader() {
  return (
    <Suspense fallback={null}>
      <NavigationLoaderInner />
    </Suspense>
  );
}
