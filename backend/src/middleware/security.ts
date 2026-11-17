import type { NextFunction, Request, Response } from "express";
import { checkRateLimit } from "../lib/security";

const BLOCKED_PROBE_PATTERNS = [
  /\/\.(env|git|svn|hg|htaccess|htpasswd)/i,
  /\/(wp-admin|wp-login\.php|xmlrpc\.php|phpmyadmin|pma|adminer)/i,
  /\.\.[/\\]/,
];

export function securityMiddleware(req: Request, res: Response, next: NextFunction): void {
  const target = req.originalUrl || req.url;
  if (BLOCKED_PROBE_PATTERNS.some((re) => re.test(target))) {
    res.status(403).json({ error: "Blocked by application firewall." });
    return;
  }

  const isAdminRoute = target.startsWith("/api/admin");
  if (isAdminRoute) {
    const ip = req.ip || "unknown";
    const rl = checkRateLimit(`admin-api:${ip}`, 120, 60 * 1000);
    if (!rl.allowed) {
      res.setHeader("Retry-After", String(rl.retryAfterSec));
      res.status(429).json({ error: "Admin API rate limit exceeded. Please slow down." });
      return;
    }

    if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
      const origin = req.headers.origin;
      const allowedOrigins = (process.env.CORS_ORIGIN || "http://localhost:3000")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (origin && !allowedOrigins.includes(origin)) {
        res.status(403).json({ error: "Cross-origin admin state mutation blocked." });
        return;
      }
    }

    res.setHeader("X-Robots-Tag", "noindex, nofollow");
    res.setHeader("Cache-Control", "no-store, private, max-age=0");
  }

  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", isAdminRoute ? "DENY" : "SAMEORIGIN");
  res.setHeader("Referrer-Policy", isAdminRoute ? "no-referrer" : "strict-origin-when-cross-origin");
  res.setHeader("X-DNS-Prefetch-Control", "off");
  if (process.env.NODE_ENV === "production") {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  next();
}

