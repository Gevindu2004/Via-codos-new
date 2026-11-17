import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const BLOCKED_PROBE_PATTERNS = [
  /\/\.(env|git|svn|hg|htaccess|htpasswd)/i,
  /\/(wp-admin|wp-login\.php|xmlrpc\.php|phpmyadmin|pma|adminer)/i,
  /\.\.[/\\]/,
];

const globalForEdge = globalThis as unknown as {
  __vcEdgeAdminRate?: Map<string, { count: number; resetAt: number }>;
};
const edgeRateMap = (globalForEdge.__vcEdgeAdminRate ??= new Map());

function checkAdminEdgeRate(ip: string): boolean {
  const now = Date.now();
  const entry = edgeRateMap.get(ip);
  if (!entry || now > entry.resetAt) {
    edgeRateMap.set(ip, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  entry.count += 1;
  return entry.count <= 120;
}

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const fullTarget = `${pathname}${search}`;

  if (BLOCKED_PROBE_PATTERNS.some((re) => re.test(fullTarget))) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const isAdminUi = pathname === "/admin" || pathname.startsWith("/admin/");
  const isAdminApi = pathname.startsWith("/api/admin/");

  if (isAdminApi) {
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip")?.trim() ||
      "local";
    if (!checkAdminEdgeRate(ip)) {
      return NextResponse.json(
        { error: "Admin API rate limit exceeded. Please slow down." },
        { status: 429 }
      );
    }

    if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
      const origin = req.headers.get("origin");
      const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
      if (origin && host) {
        try {
          const originHost = new URL(origin).host;
          if (originHost !== host) {
            return NextResponse.json(
              { error: "Cross-origin admin state mutation blocked." },
              { status: 403 }
            );
          }
        } catch {
          return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
        }
      }
    }
  }

  const res = NextResponse.next();
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("X-Frame-Options", isAdminUi || isAdminApi ? "DENY" : "SAMEORIGIN");
  res.headers.set("Referrer-Policy", isAdminUi || isAdminApi ? "no-referrer" : "strict-origin-when-cross-origin");
  res.headers.set("X-DNS-Prefetch-Control", "off");
  res.headers.set("Permissions-Policy", "camera=(self), microphone=(self), geolocation=()");

  if (isAdminUi || isAdminApi) {
    res.headers.set("X-Robots-Tag", "noindex, nofollow");
    res.headers.set("Cache-Control", "no-store, private, max-age=0");
  }

  if (process.env.NODE_ENV === "production") {
    res.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }

  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

