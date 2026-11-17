import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { healthRouter } from "./routes/health";
import { authRouter } from "./routes/auth";
import { talentRouter } from "./routes/talent";
import { portalRouter } from "./routes/portal";
import { adminRouter } from "./routes/admin";
import { publicRouter } from "./routes/public";
import { securityMiddleware } from "./middleware/security";
import { getSafeImageContentType, resolveUploadStorageDir } from "./lib/security";

const app = express();
const PORT = Number(process.env.PORT || "4000");

app.set("trust proxy", 1);
app.use(securityMiddleware);

const allowedOrigins = (process.env.CORS_ORIGIN || "http://localhost:3000")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS origin blocked: ${origin}`));
      }
    },
    credentials: true,
  })
);

app.use(cookieParser());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Serve uploaded media from outside executable/webroot directories without execution
const serveSafeUploadedMedia = async (req: express.Request, res: express.Response) => {
  const safeName = path.basename(String(req.params.filename || ""));
  const contentType = getSafeImageContentType(safeName);
  if (!contentType || safeName !== req.params.filename) {
    res.status(400).json({ error: "Invalid media file." });
    return;
  }
  const absPath = path.join(resolveUploadStorageDir("uploads"), safeName);
  try {
    await fs.access(absPath);
    res.setHeader("Content-Type", contentType);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Security-Policy", "default-src 'none'; sandbox");
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.sendFile(absPath);
  } catch {
    res.status(404).json({ error: "Media file not found." });
  }
};
app.get("/api/media/:filename", serveSafeUploadedMedia);
app.get("/uploads/:filename", serveSafeUploadedMedia);

// API routes
app.use("/api", healthRouter);
app.use("/api", authRouter);
app.use("/api", talentRouter);
app.use("/api", portalRouter);
app.use("/api", adminRouter);
app.use("/api", publicRouter);

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("Unhandled backend error:", err);
  res.status(500).json({ error: "Internal server error." });
});

app.listen(PORT, () => {
  console.log(`Via Codos Backend API (Azure SQL) listening on http://localhost:${PORT}`);
});

