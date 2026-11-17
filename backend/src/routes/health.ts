import { Router } from "express";
import { prisma } from "../lib/prisma";

export const healthRouter = Router();

healthRouter.get("/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1 AS ok`;
    res.json({
      ok: true,
      service: "via-codos-backend",
      database: "azure-sql",
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Azure SQL health check failed:", err);
    res.status(503).json({
      ok: false,
      service: "via-codos-backend",
      database: "azure-sql",
      error: "Database connection unavailable.",
    });
  }
});

