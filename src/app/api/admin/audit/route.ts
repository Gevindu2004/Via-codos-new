import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth";

export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [auditLogs, emails] = await Promise.all([
    prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.emailOutbox.findMany({ orderBy: { createdAt: "desc" }, take: 50 }),
  ]);

  return NextResponse.json({ auditLogs, emails });
}

