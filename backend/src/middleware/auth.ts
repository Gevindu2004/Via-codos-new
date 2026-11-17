import type { NextFunction, Request, Response } from "express";
import {
  getAdminSessionFromRequest,
  getClientSessionFromRequest,
  type AdminSessionPayload,
  type ClientSessionPayload,
} from "../lib/auth";

export interface AuthenticatedRequest extends Request {
  adminSession?: AdminSessionPayload;
  clientSession?: ClientSessionPayload;
}

export async function requireAdmin(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const session = await getAdminSessionFromRequest(req);
  if (!session) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  req.adminSession = session;
  next();
}

export async function requireClient(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const session = await getClientSessionFromRequest(req);
  if (!session) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  req.clientSession = session;
  next();
}

