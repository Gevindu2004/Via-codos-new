import crypto from "node:crypto";
import net from "node:net";
import path from "node:path";

// ============================================================================
// 1. SLIDING-WINDOW RATE LIMITER & LOGIN BRUTE-FORCE PROTECTION
// ============================================================================

interface RateRecord {
  count: number;
  resetAt: number;
}

interface LockRecord {
  failures: number;
  lockedUntil: number;
  resetAt: number;
}

const globalForSec = globalThis as unknown as {
  __vcRateLimits?: Map<string, RateRecord>;
  __vcLoginLocks?: Map<string, LockRecord>;
};

const rateMap = (globalForSec.__vcRateLimits ??= new Map());
const lockMap = (globalForSec.__vcLoginLocks ??= new Map());

export function getClientIp(headers: Headers | Record<string, string | string[] | undefined>): string {
  const getHeader = (name: string): string | undefined => {
    if (headers instanceof Headers) {
      return headers.get(name) ?? undefined;
    }
    const v = headers[name] ?? headers[name.toLowerCase()];
    return Array.isArray(v) ? v[0] : v;
  };
  const forwarded = getHeader("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  const realIp = getHeader("x-real-ip");
  if (realIp) return realIp.trim();
  return "127.0.0.1";
}

export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): { allowed: boolean; retryAfterSec: number; remaining: number } {
  const now = Date.now();
  const existing = rateMap.get(key);
  if (!existing || now > existing.resetAt) {
    rateMap.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSec: 0, remaining: maxRequests - 1 };
  }
  existing.count += 1;
  if (existing.count > maxRequests) {
    return {
      allowed: false,
      retryAfterSec: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
      remaining: 0,
    };
  }
  return {
    allowed: true,
    retryAfterSec: 0,
    remaining: Math.max(0, maxRequests - existing.count),
  };
}

export function checkLoginLockout(key: string): { locked: boolean; retryAfterSec: number } {
  const now = Date.now();
  const rec = lockMap.get(key);
  if (!rec) return { locked: false, retryAfterSec: 0 };
  if (rec.lockedUntil > now) {
    return {
      locked: true,
      retryAfterSec: Math.max(1, Math.ceil((rec.lockedUntil - now) / 1000)),
    };
  }
  if (now > rec.resetAt) {
    lockMap.delete(key);
  }
  return { locked: false, retryAfterSec: 0 };
}

export function recordLoginFailure(
  key: string,
  maxFailures = 5,
  windowMs = 15 * 60 * 1000,
  lockDurationMs = 15 * 60 * 1000
): { locked: boolean; attemptsRemaining: number } {
  const now = Date.now();
  const existing = lockMap.get(key);
  if (!existing || now > existing.resetAt) {
    lockMap.set(key, { failures: 1, lockedUntil: 0, resetAt: now + windowMs });
    return { locked: false, attemptsRemaining: maxFailures - 1 };
  }
  existing.failures += 1;
  if (existing.failures >= maxFailures) {
    existing.lockedUntil = now + lockDurationMs;
    return { locked: true, attemptsRemaining: 0 };
  }
  return { locked: false, attemptsRemaining: Math.max(0, maxFailures - existing.failures) };
}

export function clearLoginFailures(key: string): void {
  lockMap.delete(key);
}

// ============================================================================
// 2. AES-256-GCM ENCRYPTION FOR SENSITIVE FIELDS AT REST
// ============================================================================

function getEncryptionKey(): Buffer {
  const base = process.env.DATA_ENCRYPTION_KEY || process.env.AUTH_SECRET || "ephemeral-fallback";
  return crypto.createHash("sha256").update(`vc-enc:${base}`).digest();
}

export function encryptSensitive(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decryptSensitive(payload: string): string | null {
  try {
    const parts = payload.split(":");
    if (parts.length !== 4 || parts[0] !== "v1") return null;
    const [, ivHex, tagHex, dataHex] = parts;
    const key = getEncryptionKey();
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(ivHex, "hex"));
    decipher.setAuthTag(Buffer.from(tagHex, "hex"));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(dataHex, "hex")),
      decipher.final(),
    ]);
    return decrypted.toString("utf8");
  } catch {
    return null;
  }
}

// ============================================================================
// 3. RFC 6238 TOTP MFA FOR ADMIN ACCOUNTS (NO EXTERNAL DEPENDENCY)
// ============================================================================

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function generateTotpSecret(bytes = 20): string {
  const raw = crypto.randomBytes(bytes);
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of raw) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    out += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return out;
}

function decodeBase32(input: string): Buffer {
  const clean = input.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const idx = BASE32_ALPHABET.indexOf(ch);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

function computeHotp(secretBase32: string, counter: number): string {
  const key = decodeBase32(secretBase32);
  const counterBuf = Buffer.alloc(8);
  counterBuf.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  counterBuf.writeUInt32BE(counter >>> 0, 4);

  const hmac = crypto.createHmac("sha1", key).update(counterBuf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return String(code % 1_000_000).padStart(6, "0");
}

export function verifyTotpCode(secretBase32: string, userCode: string, window = 1): boolean {
  const cleanCode = String(userCode || "").replace(/\s+/g, "");
  if (!/^\d{6}$/.test(cleanCode)) return false;
  const currentStep = Math.floor(Date.now() / 1000 / 30);
  const userBuf = Buffer.from(cleanCode, "utf8");

  for (let delta = -window; delta <= window; delta++) {
    const expected = computeHotp(secretBase32, currentStep + delta);
    const expBuf = Buffer.from(expected, "utf8");
    if (userBuf.length === expBuf.length && crypto.timingSafeEqual(userBuf, expBuf)) {
      return true;
    }
  }
  return false;
}

export function buildOtpAuthUri(email: string, secretBase32: string, issuer = "Via Codos Admin"): string {
  return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(email)}?secret=${encodeURIComponent(secretBase32)}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}

// ============================================================================
// 4. HTML ESCAPING, RICH HTML SANITIZATION & UPLOAD ALLOWLISTS
// ============================================================================

import { sanitizeRichHtml } from "@/lib/sanitize";
export { sanitizeRichHtml };

export function escapeHtml(input: string | null | undefined): string {
  return String(input ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const ALLOWED_MEDIA_EXTS = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif"]);
const ALLOWED_CV_EXTS = new Set([".pdf", ".doc", ".docx"]);
const ALLOWED_RECORDING_EXTS = new Set([".webm", ".mp4", ".ogg"]);
const FORBIDDEN_FILENAME_EXTS = new Set([
  "php", "php3", "php4", "php5", "php7", "php8", "phtml", "phar",
  "asp", "aspx", "ashx", "asmx", "jsp", "jspx", "cgi", "pl", "py", "rb",
  "sh", "bash", "zsh", "bat", "cmd", "ps1", "vbs", "vbe", "js", "mjs", "cjs",
  "exe", "dll", "msi", "scr", "com", "hta", "html", "htm", "xhtml", "svg",
]);

const UPLOAD_LIMIT_BYTES: Record<"media" | "cv" | "recording", number> = {
  media: 10 * 1024 * 1024,
  cv: 5 * 1024 * 1024,
  recording: 25 * 1024 * 1024,
};

export function resolveUploadStorageDir(bucket: "uploads" | "cvs" | "interviews"): string {
  const baseDir = process.env.UPLOAD_STORAGE_DIR
    ? path.resolve(process.env.UPLOAD_STORAGE_DIR)
    : path.resolve(process.cwd(), "storage");
  return path.join(baseDir, bucket);
}

export function getSafeImageContentType(filename: string): string | null {
  switch (path.extname(filename).toLowerCase()) {
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".webp":
      return "image/webp";
    case ".gif":
      return "image/gif";
    default:
      return null;
  }
}

export function validateUploadFile(
  filename: string,
  mimeType: string,
  sizeBytes: number,
  kind: "media" | "cv" | "recording" = "media"
): { ok: true; ext: string } | { ok: false; error: string } {
  if (!filename || sizeBytes <= 0) {
    return { ok: false, error: "File is required." };
  }
  const maxBytes = UPLOAD_LIMIT_BYTES[kind];
  if (sizeBytes > maxBytes) {
    const mb = Math.round(maxBytes / (1024 * 1024));
    return { ok: false, error: `File exceeds maximum allowed size of ${mb} MB.` };
  }
  if (filename.includes("\0") || filename.includes("/") || filename.includes("\\")) {
    return { ok: false, error: "Invalid characters in uploaded filename." };
  }

  const baseName = path.basename(filename);
  const parts = baseName.toLowerCase().split(".").filter(Boolean);
  if (parts.length < 2) {
    return { ok: false, error: "Uploaded file must have a valid file extension." };
  }
  if (parts.slice(1).some((segment) => FORBIDDEN_FILENAME_EXTS.has(segment))) {
    return { ok: false, error: "Executable or active script file extensions are not permitted." };
  }

  const ext = `.${parts[parts.length - 1]}`;
  const cleanMime = String(mimeType || "").toLowerCase();

  if (kind === "media") {
    if (!ALLOWED_MEDIA_EXTS.has(ext)) {
      return { ok: false, error: "Unsupported image format. Allowed: PNG, JPG, JPEG, WEBP, GIF." };
    }
    if ((cleanMime && !cleanMime.startsWith("image/")) || cleanMime.includes("svg")) {
      return { ok: false, error: "Invalid image MIME type." };
    }
    return { ok: true, ext };
  }

  if (kind === "recording") {
    if (!ALLOWED_RECORDING_EXTS.has(ext)) {
      return { ok: false, error: "Unsupported recording format. Allowed: WEBM, MP4, OGG." };
    }
    return { ok: true, ext };
  }

  if (!ALLOWED_CV_EXTS.has(ext)) {
    return { ok: false, error: "Unsupported CV format. Allowed: PDF, DOC, DOCX." };
  }
  return { ok: true, ext };
}

function detectMagicSignature(
  buffer: Buffer,
  kind: "media" | "cv" | "recording"
): { ext: string; mimeType: string } | null {
  if (buffer.length < 12) return null;

  if (kind === "media") {
    if (
      buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47 &&
      buffer[4] === 0x0d && buffer[5] === 0x0a && buffer[6] === 0x1a && buffer[7] === 0x0a
    ) {
      return { ext: ".png", mimeType: "image/png" };
    }
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
      return { ext: ".jpg", mimeType: "image/jpeg" };
    }
    const gifHeader = buffer.subarray(0, 6).toString("ascii");
    if (gifHeader === "GIF87a" || gifHeader === "GIF89a") {
      return { ext: ".gif", mimeType: "image/gif" };
    }
    if (
      buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
      buffer.subarray(8, 12).toString("ascii") === "WEBP"
    ) {
      return { ext: ".webp", mimeType: "image/webp" };
    }
    return null;
  }

  if (kind === "recording") {
    if (buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3) {
      return { ext: ".webm", mimeType: "video/webm" };
    }
    if (buffer.subarray(4, 8).toString("ascii") === "ftyp") {
      return { ext: ".mp4", mimeType: "video/mp4" };
    }
    if (buffer.subarray(0, 4).toString("ascii") === "OggS") {
      return { ext: ".ogg", mimeType: "audio/ogg" };
    }
    return null;
  }

  // CV documents: PDF (%PDF-), legacy DOC (OLE2), DOCX (PKZIP OOXML without macros)
  if (buffer.subarray(0, 8).toString("ascii").includes("%PDF-")) {
    return { ext: ".pdf", mimeType: "application/pdf" };
  }
  if (
    buffer[0] === 0xd0 && buffer[1] === 0xcf && buffer[2] === 0x11 && buffer[3] === 0xe0 &&
    buffer[4] === 0xa1 && buffer[5] === 0xb1 && buffer[6] === 0x1a && buffer[7] === 0xe1
  ) {
    return { ext: ".doc", mimeType: "application/msword" };
  }
  if (buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04) {
    const rawLatin = buffer.toString("latin1");
    if (rawLatin.includes("[Content_Types].xml") && rawLatin.includes("word/")) {
      return {
        ext: ".docx",
        mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      };
    }
  }
  return null;
}

const EICAR_SIGNATURE =
  "X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*";

function scanBufferForMaliciousPayloads(
  buffer: Buffer,
  kind: "media" | "cv" | "recording",
  detectedExt: string
): string | null {
  // Block Windows PE executables (MZ), ELF binaries, Mach-O binaries, and shell shebangs
  if (
    (buffer[0] === 0x4d && buffer[1] === 0x5a) ||
    (buffer[0] === 0x7f && buffer[1] === 0x45 && buffer[2] === 0x4c && buffer[3] === 0x46) ||
    (buffer[0] === 0xfe && buffer[1] === 0xed && buffer[2] === 0xfa && (buffer[3] === 0xce || buffer[3] === 0xcf)) ||
    (buffer[0] === 0xcf && buffer[1] === 0xfa && buffer[2] === 0xed && buffer[3] === 0xfe) ||
    (buffer[0] === 0x23 && buffer[1] === 0x21)
  ) {
    return "Executable binary content detected and blocked.";
  }

  const textView = buffer.toString("latin1");
  if (textView.includes(EICAR_SIGNATURE)) {
    return "Malware test signature detected and blocked.";
  }

  if (kind === "media" || kind === "cv") {
    if (/(<\?php|<\?=|<script[\s>]|<%[^%])/i.test(textView)) {
      return "Embedded server-side code or script payload detected in file.";
    }
  }

  if (detectedExt === ".docx" && textView.includes("vbaProject.bin")) {
    return "Macro-enabled Word documents are blocked for security.";
  }

  if (detectedExt === ".pdf" && /\/(JavaScript|JS|Launch|OpenAction|RichMedia)\b/i.test(textView)) {
    return "PDF containing active scripts or auto-launch actions is blocked.";
  }

  return null;
}

async function scanBufferWithClamAv(buffer: Buffer): Promise<string | null> {
  const host = process.env.CLAMAV_HOST;
  if (!host) return null;
  const port = Number(process.env.CLAMAV_PORT || "3310");

  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port });
    let response = "";
    const timer = setTimeout(() => {
      socket.destroy();
      resolve(process.env.UPLOAD_REQUIRE_AV === "true" ? "Antivirus scanner timed out." : null);
    }, 5000);

    socket.on("connect", () => {
      socket.write("zINSTREAM\0");
      const chunkSize = 64 * 1024;
      for (let offset = 0; offset < buffer.length; offset += chunkSize) {
        const chunk = buffer.subarray(offset, offset + chunkSize);
        const lenBuf = Buffer.alloc(4);
        lenBuf.writeUInt32BE(chunk.length, 0);
        socket.write(lenBuf);
        socket.write(chunk);
      }
      const zeroBuf = Buffer.alloc(4);
      socket.write(zeroBuf);
    });

    socket.on("data", (data) => {
      response += data.toString("utf8");
    });

    socket.on("end", () => {
      clearTimeout(timer);
      if (/FOUND/i.test(response)) {
        resolve("Upload rejected by malware scanner.");
      } else {
        resolve(null);
      }
    });

    socket.on("error", () => {
      clearTimeout(timer);
      resolve(process.env.UPLOAD_REQUIRE_AV === "true" ? "Antivirus scanner unavailable." : null);
    });
  });
}

export async function validateAndScanUploadBuffer(
  filename: string,
  mimeType: string,
  buffer: Buffer,
  kind: "media" | "cv" | "recording"
): Promise<{ ok: true; ext: string; mimeType: string; safeFilename: string } | { ok: false; error: string }> {
  const preCheck = validateUploadFile(filename, mimeType, buffer.length, kind);
  if (!preCheck.ok) {
    return preCheck;
  }

  const detected = detectMagicSignature(buffer, kind);
  if (!detected) {
    return {
      ok: false,
      error: "File content signature does not match an allowed file format.",
    };
  }

  const normalizedExt = preCheck.ext === ".jpeg" ? ".jpg" : preCheck.ext;
  if (normalizedExt !== detected.ext) {
    return {
      ok: false,
      error: `File extension (${preCheck.ext}) does not match actual binary content (${detected.ext}).`,
    };
  }

  const heuristicIssue = scanBufferForMaliciousPayloads(buffer, kind, detected.ext);
  if (heuristicIssue) {
    return { ok: false, error: heuristicIssue };
  }

  const clamIssue = await scanBufferWithClamAv(buffer);
  if (clamIssue) {
    return { ok: false, error: clamIssue };
  }

  return {
    ok: true,
    ext: detected.ext,
    mimeType: detected.mimeType,
    safeFilename: `${crypto.randomUUID()}${detected.ext}`,
  };
}
