import crypto from "node:crypto";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";

const globalForAuth = globalThis as unknown as { __vcEphemeralAuthSecret?: string };

function getAuthSecretKey(): Uint8Array {
  const configured = process.env.AUTH_SECRET;
  if (configured && configured.length > 0) {
    return new TextEncoder().encode(configured);
  }
  if (!globalForAuth.__vcEphemeralAuthSecret) {
    globalForAuth.__vcEphemeralAuthSecret = crypto.randomBytes(32).toString("hex");
  }
  return new TextEncoder().encode(globalForAuth.__vcEphemeralAuthSecret);
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

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
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
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(SECRET_KEY);
}

export async function signClientToken(payload: ClientSessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("14d")
    .sign(SECRET_KEY);
}

export async function verifyAdminToken(token: string): Promise<AdminSessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET_KEY);
    if (payload.kind !== "admin") return null;
    return payload as unknown as AdminSessionPayload;
  } catch {
    return null;
  }
}

export async function verifyClientToken(token: string): Promise<ClientSessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET_KEY);
    if (payload.kind !== "client") return null;
    return payload as unknown as ClientSessionPayload;
  } catch {
    return null;
  }
}

export async function getAdminSession(): Promise<AdminSessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE)?.value;
  if (!token) return null;
  return verifyAdminToken(token);
}

export async function getClientSession(): Promise<ClientSessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(CLIENT_COOKIE)?.value;
  if (!token) return null;
  return verifyClientToken(token);
}

