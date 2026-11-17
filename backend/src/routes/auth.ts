import { Router } from "express";
import { prisma } from "../lib/prisma";
import {
  ADMIN_COOKIE,
  CLIENT_COOKIE,
  getAdminSessionFromRequest,
  getClientSessionFromRequest,
  hashPassword,
  signAdminToken,
  signClientToken,
  verifyPassword,
} from "../lib/auth";
import {
  buildOtpAuthUri,
  checkLoginLockout,
  checkRateLimit,
  clearLoginFailures,
  decryptSensitive,
  encryptSensitive,
  generateTotpSecret,
  recordLoginFailure,
  verifyTotpCode,
} from "../lib/security";
import { recordAuditLog } from "../lib/audit";
import { requireAdmin, type AuthenticatedRequest } from "../middleware/auth";

export const authRouter = Router();

const COOKIE_BASE = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};

authRouter.get("/admin/auth/me", async (req, res) => {
  const session = await getAdminSessionFromRequest(req);
  if (!session) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  res.json({ user: session });
});

authRouter.post("/admin/auth/login", async (req, res) => {
  try {
    const ip = req.ip || "127.0.0.1";
    const ipLimit = checkRateLimit(`backend-admin-ip:${ip}`, 20, 15 * 60 * 1000);
    if (!ipLimit.allowed) {
      res.setHeader("Retry-After", String(ipLimit.retryAfterSec));
      res.status(429).json({ error: "Too many login attempts. Please try again later." });
      return;
    }

    const { email, password, totpCode } = req.body ?? {};
    if (!email || !password) {
      res.status(400).json({ error: "Email and password required." });
      return;
    }

    const cleanEmail = String(email).toLowerCase().trim();
    const lockKey = `admin:${ip}:${cleanEmail}`;
    const lockState = checkLoginLockout(lockKey);
    if (lockState.locked) {
      res.setHeader("Retry-After", String(lockState.retryAfterSec));
      res.status(429).json({
        error: `Account temporarily locked. Try again in ${lockState.retryAfterSec}s.`,
      });
      return;
    }

    const user = await prisma.adminUser.findUnique({ where: { email: cleanEmail } });
    if (!user || !user.isActive || !verifyPassword(String(password), user.passwordHash)) {
      recordLoginFailure(lockKey);
      res.status(401).json({ error: "Invalid administrator credentials." });
      return;
    }

    if (user.mfaEnabled && user.mfaSecret) {
      if (!totpCode) {
        res.json({ mfaRequired: true });
        return;
      }
      const decrypted = decryptSensitive(user.mfaSecret);
      if (!decrypted || !verifyTotpCode(decrypted, String(totpCode))) {
        recordLoginFailure(lockKey);
        res.status(401).json({ error: "Invalid MFA authenticator code.", mfaRequired: true });
        return;
      }
    }

    clearLoginFailures(lockKey);

    const token = await signAdminToken({
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      kind: "admin",
    });

    await recordAuditLog({
      actorId: user.id,
      actorEmail: user.email,
      actorRole: user.role,
      action: "LOGIN",
      entityType: "AdminUser",
      entityId: user.id,
      entityLabel: user.email,
      summary: `Administrator ${user.email} signed in`,
      ipAddress: ip,
    });

    res.cookie(ADMIN_COOKIE, token, { ...COOKIE_BASE, maxAge: 60 * 60 * 12 * 1000 });
    res.json({
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
      token,
    });
  } catch (err) {
    console.error("Admin login error:", err);
    res.status(500).json({ error: "Login failed." });
  }
});

authRouter.get("/admin/auth/mfa", requireAdmin, async (req: AuthenticatedRequest, res) => {
  const user = await prisma.adminUser.findUnique({
    where: { id: req.adminSession!.userId },
    select: { mfaEnabled: true },
  });
  res.json({ mfaEnabled: Boolean(user?.mfaEnabled) });
});

authRouter.post("/admin/auth/mfa", requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const session = req.adminSession!;
    const { action, totpCode } = req.body ?? {};
    const user = await prisma.adminUser.findUnique({ where: { id: session.userId } });
    if (!user) {
      res.status(404).json({ error: "Admin account not found." });
      return;
    }

    if (action === "SETUP") {
      const secret = generateTotpSecret();
      await prisma.adminUser.update({
        where: { id: user.id },
        data: { mfaSecret: encryptSensitive(secret), mfaEnabled: false },
      });
      res.json({ secret, otpAuthUri: buildOtpAuthUri(user.email, secret) });
      return;
    }

    if (action === "ENABLE") {
      if (!user.mfaSecret) {
        res.status(400).json({ error: "Generate an MFA secret first." });
        return;
      }
      const secret = decryptSensitive(user.mfaSecret);
      if (!secret || !verifyTotpCode(secret, String(totpCode || ""))) {
        res.status(400).json({ error: "Invalid 6-digit authenticator code." });
        return;
      }
      await prisma.adminUser.update({ where: { id: user.id }, data: { mfaEnabled: true } });
      res.json({ mfaEnabled: true });
      return;
    }

    if (action === "DISABLE") {
      if (user.mfaEnabled && user.mfaSecret) {
        const secret = decryptSensitive(user.mfaSecret);
        if (!secret || !verifyTotpCode(secret, String(totpCode || ""))) {
          res.status(400).json({ error: "Provide a valid 6-digit code to disable MFA." });
          return;
        }
      }
      await prisma.adminUser.update({
        where: { id: user.id },
        data: { mfaEnabled: false, mfaSecret: null },
      });
      res.json({ mfaEnabled: false });
      return;
    }

    res.status(400).json({ error: "Unknown MFA action." });
  } catch (err) {
    console.error("MFA error:", err);
    res.status(500).json({ error: "MFA operation failed." });
  }
});

authRouter.post("/admin/auth/logout", (_req, res) => {
  res.clearCookie(ADMIN_COOKIE, { path: "/" });
  res.json({ ok: true });
});

authRouter.get("/portal/auth/me", async (req, res) => {
  const session = await getClientSessionFromRequest(req);
  if (!session) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  res.json({ client: session });
});

authRouter.post("/portal/auth/login", async (req, res) => {
  try {
    const ip = req.ip || "127.0.0.1";
    const ipLimit = checkRateLimit(`backend-portal-ip:${ip}`, 30, 15 * 60 * 1000);
    if (!ipLimit.allowed) {
      res.setHeader("Retry-After", String(ipLimit.retryAfterSec));
      res.status(429).json({ error: "Too many login attempts. Please try again later." });
      return;
    }

    const { email, password } = req.body ?? {};
    if (!email || !password) {
      res.status(400).json({ error: "Email and password required." });
      return;
    }

    const cleanEmail = String(email).toLowerCase().trim();
    const lockKey = `client:${ip}:${cleanEmail}`;
    const lockState = checkLoginLockout(lockKey);
    if (lockState.locked) {
      res.setHeader("Retry-After", String(lockState.retryAfterSec));
      res.status(429).json({
        error: `Too many failed attempts. Try again in ${lockState.retryAfterSec}s.`,
      });
      return;
    }

    const client = await prisma.clientUser.findUnique({ where: { email: cleanEmail } });
    if (!client || !verifyPassword(String(password), client.passwordHash)) {
      recordLoginFailure(lockKey);
      res.status(401).json({ error: "Invalid email or password." });
      return;
    }

    clearLoginFailures(lockKey);

    const token = await signClientToken({
      clientId: client.id,
      email: client.email,
      name: client.name,
      companyName: client.companyName,
      verificationStatus: client.verificationStatus,
      kind: "client",
    });

    res.cookie(CLIENT_COOKIE, token, { ...COOKIE_BASE, maxAge: 60 * 60 * 24 * 14 * 1000 });
    res.json({
      client: {
        id: client.id,
        name: client.name,
        email: client.email,
        companyName: client.companyName,
        verificationStatus: client.verificationStatus,
      },
      token,
    });
  } catch (err) {
    console.error("Client login error:", err);
    res.status(500).json({ error: "Login failed." });
  }
});

authRouter.post("/portal/auth/register", async (req, res) => {
  try {
    const ip = req.ip || "127.0.0.1";
    const limit = checkRateLimit(`backend-portal-register:${ip}`, 10, 15 * 60 * 1000);
    if (!limit.allowed) {
      res.setHeader("Retry-After", String(limit.retryAfterSec));
      res.status(429).json({ error: "Too many registration attempts. Please try again later." });
      return;
    }

    const {
      name,
      email,
      password,
      companyName,
      companyWebsite,
      companyCountry,
      jobTitle,
      phone,
    } = req.body ?? {};

    if (!name || !email || !password || !companyName) {
      res.status(400).json({
        error: "Full name, work email, password, and company name are required.",
      });
      return;
    }
    if (String(password).length < 8) {
      res.status(400).json({ error: "Password must be at least 8 characters long." });
      return;
    }

    const cleanEmail = String(email).toLowerCase().trim();
    const existing = await prisma.clientUser.findUnique({ where: { email: cleanEmail } });
    if (existing) {
      res.status(409).json({
        error: "An account with this email already exists. Please log in instead.",
      });
      return;
    }

    const client = await prisma.clientUser.create({
      data: {
        name: String(name).trim(),
        email: cleanEmail,
        passwordHash: hashPassword(String(password)),
        companyName: String(companyName).trim(),
        companyWebsite: companyWebsite ? String(companyWebsite).trim() : null,
        companyCountry: companyCountry ? String(companyCountry).trim() : null,
        jobTitle: jobTitle ? String(jobTitle).trim() : null,
        phone: phone ? String(phone).trim() : null,
        verificationStatus: "PENDING",
      },
    });

    const token = await signClientToken({
      clientId: client.id,
      email: client.email,
      name: client.name,
      companyName: client.companyName,
      verificationStatus: client.verificationStatus,
      kind: "client",
    });

    res.cookie(CLIENT_COOKIE, token, { ...COOKIE_BASE, maxAge: 60 * 60 * 24 * 14 * 1000 });
    res.json({
      client: {
        id: client.id,
        name: client.name,
        email: client.email,
        companyName: client.companyName,
        verificationStatus: client.verificationStatus,
      },
      token,
    });
  } catch (err) {
    console.error("Client registration error:", err);
    res.status(500).json({ error: "Registration failed." });
  }
});

authRouter.post("/portal/auth/logout", (_req, res) => {
  res.clearCookie(CLIENT_COOKIE, { path: "/" });
  res.json({ ok: true });
});
