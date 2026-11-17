import crypto from "node:crypto";
import type { Request } from "express";
import { SignJWT, jwtVerify } from "jose";

const globalForAuth = globalThis as unknown as { __vcBackendAuthSecret?: string };

function getAuthSecretKey(): Uint8Array {
  const configured = process.env.AUTH_SECRET;
  if (configured && configured.length > 0) {
    return new TextEncoder().encode(configured);
  }
  if (!globalForAuth.__vcBackendAuthSecret) {
    globalForAuth.__vcBackendAuthSecret = crypto.randomBytes(32).toString("hex");
  }
  return new TextEncoder().encode(globalForAuth.__vcBackendAuthSecret);
}

const SECRET_KEY = getAuthSecretKey();

export const ADMIN_COOKIE = "vc_admin_session";
export const CLIENT_COOKIE = "vc_client_session";

export interface AdminSessionPayload {
  userId: string;
  email: string;
  name: string;
  role: string;
  kind: "admin";
}

export interface ClientSessionPayload {
  clientId: string;
  email: string;
  name: string;
  companyName: string;
  verificationStatus: string;
  kind: "client";
}

const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1 } as const;

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(password, salt, 64, SCRYPT_PARAMS).toString("hex");
  return `scrypt$N=${SCRYPT_PARAMS.N},r=${SCRYPT_PARAMS.r},p=${SCRYPT_PARAMS.p}$${salt}$${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  if (storedHash.startsWith("scrypt$")) {
    const parts = storedHash.split("$");
    if (parts.length !== 4) return false;
    const [, paramStr, salt, originalHex] = parts;
    const params: Record<string, number> = {};
    for (const seg of paramStr.split(",")) {
      const [k, v] = seg.split("=");
      params[k] = Number(v);
    }
    const derived = crypto.scryptSync(password, salt, 64, {
      N: params.N || 16384,
      r: params.r || 8,
      p: params.p || 1,
    });
    const original = Buffer.from(originalHex, "hex");
    if (derived.length !== original.length) return false;
    return crypto.timingSafeEqual(derived, original);
  }

  const parts = storedHash.split(":");
  if (parts.length !== 2) return false;
  const [salt, originalHex] = parts;
  const derived = crypto.scryptSync(password, salt, 64);
  const original = Buffer.from(originalHex, "hex");
  if (derived.length !== original.length) return false;
  return crypto.timingSafeEqual(derived, original);
}

export async function signAdminToken(payload: AdminSessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer("via-codos")
    .setAudience("via-codos-admin")
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(SECRET_KEY);
}

export async function signClientToken(payload: ClientSessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer("via-codos")
    .setAudience("via-codos-client")
    .setIssuedAt()
    .setExpirationTime("14d")
    .sign(SECRET_KEY);
}

export async function verifyAdminToken(token: string): Promise<AdminSessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET_KEY, {
      issuer: "via-codos",
      audience: "via-codos-admin",
    });
    if (payload.kind !== "admin") return null;
    return payload as unknown as AdminSessionPayload;
  } catch {
    return null;
  }
}

export async function verifyClientToken(token: string): Promise<ClientSessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET_KEY, {
      issuer: "via-codos",
      audience: "via-codos-client",
    });
    if (payload.kind !== "client") return null;
    return payload as unknown as ClientSessionPayload;
  } catch {
    return null;
  }
}

export function hasAdminRole(
  session: AdminSessionPayload | null,
  allowedRoles: string[]
): boolean {
  if (!session) return false;
  return allowedRoles.includes(session.role);
}

export function extractTokenFromRequest(req: Request, cookieName: string): string | null {
  const cookieToken = req.cookies?.[cookieName];
  if (typeof cookieToken === "string" && cookieToken.length > 0) {
    return cookieToken;
  }
  const authHeader = req.headers.authorization;
  if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
    return authHeader.slice(7).trim();
  }
  return null;
}

export async function getAdminSessionFromRequest(
  req: Request
): Promise<AdminSessionPayload | null> {
  const token = extractTokenFromRequest(req, ADMIN_COOKIE);
  if (!token) return null;
  return verifyAdminToken(token);
}

export async function getClientSessionFromRequest(
  req: Request
): Promise<ClientSessionPayload | null> {
  const token = extractTokenFromRequest(req, CLIENT_COOKIE);
  if (!token) return null;
  return verifyClientToken(token);
}

