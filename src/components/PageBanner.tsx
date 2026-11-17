import React from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

interface Crumb {
  label: string;
  href?: string;
}

interface PageBannerProps {
  crumbs: Crumb[];
  eyebrow: string;
  title: string;
  subtitle?: string;
}

export function PageBanner({ crumbs, eyebrow, title, subtitle }: PageBannerProps) {
  return (
    <section className="bg-[#0A192F] text-white border-b border-white/10 py-14 sm:py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <nav className="flex flex-wrap items-center gap-1.5 text-xs text-slate-300 mb-5" aria-label="Breadcrumb">
          <Link href="/" className="hover:text-white transition">
            Home
          </Link>
          {crumbs.map((c, idx) => (
            <React.Fragment key={idx}>
              <ChevronRight className="h-3.5 w-3.5 text-slate-500" />
              {c.href ? (
                <Link href={c.href} className="hover:text-white transition">
                  {c.label}
                </Link>
              ) : (
                <span className="text-sky-300 font-medium">{c.label}</span>
              )}
            </React.Fragment>
          ))}
        </nav>

        <span className="inline-block text-[11px] font-bold uppercase tracking-[0.2em] text-sky-300">
          {eyebrow}
        </span>
        <h1 className="font-heading mt-2 text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight max-w-4xl">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-4 text-base sm:text-lg text-slate-300 max-w-3xl leading-relaxed">
            {subtitle}
          </p>
        )}
      </div>
    </section>
  );
}

