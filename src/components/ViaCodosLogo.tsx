import React from "react";

interface LogoProps {
  showWordmark?: boolean;
  dark?: boolean;
  size?: number;
  className?: string;
}

/**
 * Renders the transparent official Via Codos mark (logo-official-mark.png)
 * cleanly across light and dark surfaces.
 */
export function ViaCodosMark({
  size = 36,
  dark = false,
  className = "",
}: {
  size?: number;
  dark?: boolean;
  className?: string;
}) {
  return (
    <img
      src="/assets/logo-official-mark.png"
      alt="Via Codos Emblem"
      style={{ height: size, width: "auto" }}
      className={`object-contain select-none ${dark ? "brightness-125" : ""} ${className}`}
    />
  );
}

export function ViaCodosLogo({
  showWordmark = true,
  dark = false,
  size = 38,
  className = "",
}: LogoProps) {
  return (
    <span className={`inline-flex items-center gap-3 select-none ${className}`}>
      <ViaCodosMark size={size} dark={dark} />
      {showWordmark && (
        <span className="inline-flex items-center gap-3">
          <span className={`h-7 w-px ${dark ? "bg-white/25" : "bg-[#0A192F]/25"}`} />
          <span className="flex flex-col leading-none">
            <span
              className={`font-heading text-lg font-bold tracking-tight ${
                dark ? "text-white" : "text-[#0A192F]"
              }`}
            >
              Via Codos
            </span>
            <span
              className={`text-[9px] font-semibold tracking-[0.26em] uppercase mt-0.5 ${
                dark ? "text-sky-300" : "text-[#1E3A8A]"
              }`}
            >
              (PVT) LTD
            </span>
          </span>
        </span>
      )}
    </span>
  );
}
