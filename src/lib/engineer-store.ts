import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";

export interface EngineerAccountRow {
  id: string;
  talentId: string;
  profileCode: string;
  email: string;
  name: string;
  passwordHash: string;
  status: string;
  createdAt: string;
}

export interface EngineerTaskRow {
  id: string;
  talentId: string;
  pipelineRequestId: string | null;
  clientId: string | null;
  title: string;
  description: string | null;
  priority: string;
  status: string;
  dueDate: string | null;
  progressNotes: string | null;
  assignedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface ClientEngineerMessageRow {
  id: string;
  pipelineRequestId: string;
  talentId: string;
  clientId: string;
  senderRole: string;
  senderName: string;
  body: string;
  createdAt: string;
}

const globalForEng = globalThis as unknown as {
  __vcEngineerSchemaReady?: Promise<void>;
};

async function initEngineerTablesAndSeed(): Promise<void> {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "EngineerAccount" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "talentId" TEXT NOT NULL UNIQUE,
      "profileCode" TEXT NOT NULL UNIQUE,
      "email" TEXT NOT NULL UNIQUE,
      "name" TEXT NOT NULL,
      "passwordHash" TEXT NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'ACTIVE',
      "createdAt" TEXT NOT NULL,
      "updatedAt" TEXT NOT NULL
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "EngineerTask" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "talentId" TEXT NOT NULL,
      "pipelineRequestId" TEXT,
      "clientId" TEXT,
      "title" TEXT NOT NULL,
      "description" TEXT,
      "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
      "status" TEXT NOT NULL DEFAULT 'TODO',
      "dueDate" TEXT,
      "progressNotes" TEXT,
      "assignedBy" TEXT NOT NULL,
      "createdAt" TEXT NOT NULL,
      "updatedAt" TEXT NOT NULL
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "ClientEngineerMessage" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "pipelineRequestId" TEXT NOT NULL,
      "talentId" TEXT NOT NULL,
      "clientId" TEXT NOT NULL,
      "senderRole" TEXT NOT NULL,
      "senderName" TEXT NOT NULL,
      "body" TEXT NOT NULL,
      "createdAt" TEXT NOT NULL
    )
  `);

  // Seed default engineer login for VC-IT-102 so the portal is testable out of the box
  const vc102 = await prisma.talentProfile.findUnique({ where: { profileCode: "VC-IT-102" } });
  if (vc102) {
    const existing = await prisma.$queryRaw<EngineerAccountRow[]>`
      SELECT * FROM "EngineerAccount" WHERE "profileCode" = ${"VC-IT-102"} LIMIT 1
    `;
    const now = new Date().toISOString();
    if (existing.length === 0) {
      const seedPwd = process.env.SEED_ENGINEER_PASSWORD || crypto.randomBytes(16).toString("hex");
      await prisma.$executeRaw`
        INSERT INTO "EngineerAccount" ("id", "talentId", "profileCode", "email", "name", "passwordHash", "status", "createdAt", "updatedAt")
        VALUES (${crypto.randomUUID()}, ${vc102.id}, ${"VC-IT-102"}, ${"engineer.vc102@viacodos.com"}, ${vc102.displayName || "Engineer VC-IT-102"}, ${hashPassword(seedPwd)}, ${"ACTIVE"}, ${now}, ${now})
      `;
    }

    const pipe = await prisma.profileRequest.findFirst({
      where: { talentId: vc102.id },
      include: { client: true },
      orderBy: { createdAt: "desc" },
    });

    const existingTasks = await prisma.$queryRaw<EngineerTaskRow[]>`
      SELECT * FROM "EngineerTask" WHERE "talentId" = ${vc102.id} LIMIT 1
    `;
    if (existingTasks.length === 0) {
      const due1 = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);
      const due2 = new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10);
      await prisma.$executeRaw`
        INSERT INTO "EngineerTask" ("id", "talentId", "pipelineRequestId", "clientId", "title", "description", "priority", "status", "dueDate", "progressNotes", "assignedBy", "createdAt", "updatedAt")
        VALUES (
          ${crypto.randomUUID()},
          ${vc102.id},
          ${pipe?.id ?? null},
          ${pipe?.clientId ?? null},
          ${"Prepare Microservices Failover Architecture Walkthrough"},
          ${"Prepare a concise walkthrough of Spring Boot + Kafka event-driven resilience patterns for your live hiring client interview."},
          ${"HIGH"},
          ${"IN_PROGRESS"},
          ${due1},
          ${"Reviewing architecture diagrams and latency benchmarks."},
          ${pipe?.client.companyName || "Via Codos Operations"},
          ${now},
          ${now}
        )
      `;
      await prisma.$executeRaw`
        INSERT INTO "EngineerTask" ("id", "talentId", "pipelineRequestId", "clientId", "title", "description", "priority", "status", "dueDate", "progressNotes", "assignedBy", "createdAt", "updatedAt")
        VALUES (
          ${crypto.randomUUID()},
          ${vc102.id},
          ${pipe?.id ?? null},
          ${pipe?.clientId ?? null},
          ${"Complete Pre-Interview AI Technical Q&A Prompts"},
          ${"Submit or join the live AI Interview Room so the hiring team can review your technical responses in real time."},
          ${"HIGH"},
          ${"TODO"},
          ${due1},
          ${null},
          ${pipe?.client.companyName || "Via Codos Operations"},
          ${now},
          ${now}
        )
      `;
      await prisma.$executeRaw`
        INSERT INTO "EngineerTask" ("id", "talentId", "pipelineRequestId", "clientId", "title", "description", "priority", "status", "dueDate", "progressNotes", "assignedBy", "createdAt", "updatedAt")
        VALUES (
          ${crypto.randomUUID()},
          ${vc102.id},
          ${pipe?.id ?? null},
          ${pipe?.clientId ?? null},
          ${"Verify Timezone Overlap & SOW Onboarding Checklist"},
          ${"Confirm availability window (4-8 hrs overlap) and NDA compliance prerequisites in the portal."},
          ${"MEDIUM"},
          ${"TODO"},
          ${due2},
          ${null},
          ${"Via Codos Operations"},
          ${now},
          ${now}
        )
      `;
    }

    if (pipe) {
      const existingMsgs = await prisma.$queryRaw<ClientEngineerMessageRow[]>`
        SELECT * FROM "ClientEngineerMessage" WHERE "pipelineRequestId" = ${pipe.id} LIMIT 1
      `;
      if (existingMsgs.length === 0) {
        await prisma.$executeRaw`
          INSERT INTO "ClientEngineerMessage" ("id", "pipelineRequestId", "talentId", "clientId", "senderRole", "senderName", "body", "createdAt")
          VALUES (
            ${crypto.randomUUID()},
            ${pipe.id},
            ${vc102.id},
            ${pipe.clientId},
            ${"client"},
            ${`${pipe.client.name} (${pipe.client.companyName})`},
            ${"Hi VC-IT-102 — welcome to our engineering shortlist! Looking forward to watching your live AI interview and discussing your Spring Boot & Kafka architecture experience."},
            ${now}
          )
        `;
      }
    }
  }
}

export async function ensureEngineerStore(): Promise<void> {
  if (!globalForEng.__vcEngineerSchemaReady) {
    globalForEng.__vcEngineerSchemaReady = initEngineerTablesAndSeed().catch((err) => {
      globalForEng.__vcEngineerSchemaReady = undefined;
      throw err;
    });
  }
  await globalForEng.__vcEngineerSchemaReady;
}

export async function findEngineerAccountByIdentifier(identifier: string): Promise<EngineerAccountRow | null> {
  await ensureEngineerStore();
  const clean = identifier.trim();
  const upperCode = clean.toUpperCase();
  const lowerEmail = clean.toLowerCase();
  const rows = await prisma.$queryRaw<EngineerAccountRow[]>`
    SELECT * FROM "EngineerAccount"
    WHERE LOWER("email") = ${lowerEmail} OR UPPER("profileCode") = ${upperCode}
    LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function findEngineerAccountById(id: string): Promise<EngineerAccountRow | null> {
  await ensureEngineerStore();
  const rows = await prisma.$queryRaw<EngineerAccountRow[]>`
    SELECT * FROM "EngineerAccount" WHERE "id" = ${id} LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function listEngineerTasks(talentId: string): Promise<EngineerTaskRow[]> {
  await ensureEngineerStore();
  return prisma.$queryRaw<EngineerTaskRow[]>`
    SELECT * FROM "EngineerTask"
    WHERE "talentId" = ${talentId}
    ORDER BY "createdAt" DESC
  `;
}

export async function createEngineerTask(input: {
  talentId: string;
  pipelineRequestId?: string | null;
  clientId?: string | null;
  title: string;
  description?: string | null;
  priority?: string;
  dueDate?: string | null;
  assignedBy: string;
}): Promise<EngineerTaskRow> {
  await ensureEngineerStore();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const priority = ["HIGH", "MEDIUM", "LOW"].includes(String(input.priority || "").toUpperCase())
    ? String(input.priority).toUpperCase()
    : "MEDIUM";

  await prisma.$executeRaw`
    INSERT INTO "EngineerTask" ("id", "talentId", "pipelineRequestId", "clientId", "title", "description", "priority", "status", "dueDate", "progressNotes", "assignedBy", "createdAt", "updatedAt")
    VALUES (
      ${id},
      ${input.talentId},
      ${input.pipelineRequestId ?? null},
      ${input.clientId ?? null},
      ${input.title},
      ${input.description ?? null},
      ${priority},
      ${"TODO"},
      ${input.dueDate ?? null},
      ${null},
      ${input.assignedBy},
      ${now},
      ${now}
    )
  `;

  const rows = await prisma.$queryRaw<EngineerTaskRow[]>`
    SELECT * FROM "EngineerTask" WHERE "id" = ${id} LIMIT 1
  `;
  return rows[0];
}

export async function updateEngineerTask(
  taskId: string,
  talentId: string,
  updates: { status?: string; progressNotes?: string | null }
): Promise<EngineerTaskRow | null> {
  await ensureEngineerStore();
  const existingRows = await prisma.$queryRaw<EngineerTaskRow[]>`
    SELECT * FROM "EngineerTask" WHERE "id" = ${taskId} AND "talentId" = ${talentId} LIMIT 1
  `;
  const existing = existingRows[0];
  if (!existing) return null;

  const validStatuses = ["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"];
  const nextStatus =
    updates.status && validStatuses.includes(updates.status) ? updates.status : existing.status;
  const nextNotes =
    updates.progressNotes !== undefined ? updates.progressNotes : existing.progressNotes;
  const now = new Date().toISOString();

  await prisma.$executeRaw`
    UPDATE "EngineerTask"
    SET "status" = ${nextStatus}, "progressNotes" = ${nextNotes}, "updatedAt" = ${now}
    WHERE "id" = ${taskId} AND "talentId" = ${talentId}
  `;

  const updated = await prisma.$queryRaw<EngineerTaskRow[]>`
    SELECT * FROM "EngineerTask" WHERE "id" = ${taskId} LIMIT 1
  `;
  return updated[0] ?? null;
}

export async function listMessagesForTalent(talentId: string): Promise<ClientEngineerMessageRow[]> {
  await ensureEngineerStore();
  return prisma.$queryRaw<ClientEngineerMessageRow[]>`
    SELECT * FROM "ClientEngineerMessage"
    WHERE "talentId" = ${talentId}
    ORDER BY "createdAt" ASC
  `;
}

export async function listMessagesForPipeline(pipelineRequestId: string): Promise<ClientEngineerMessageRow[]> {
  await ensureEngineerStore();
  return prisma.$queryRaw<ClientEngineerMessageRow[]>`
    SELECT * FROM "ClientEngineerMessage"
    WHERE "pipelineRequestId" = ${pipelineRequestId}
    ORDER BY "createdAt" ASC
  `;
}

export async function createClientEngineerMessage(input: {
  pipelineRequestId: string;
  talentId: string;
  clientId: string;
  senderRole: "client" | "engineer" | "admin";
  senderName: string;
  body: string;
}): Promise<ClientEngineerMessageRow> {
  await ensureEngineerStore();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await prisma.$executeRaw`
    INSERT INTO "ClientEngineerMessage" ("id", "pipelineRequestId", "talentId", "clientId", "senderRole", "senderName", "body", "createdAt")
    VALUES (${id}, ${input.pipelineRequestId}, ${input.talentId}, ${input.clientId}, ${input.senderRole}, ${input.senderName}, ${input.body}, ${now})
  `;
  const rows = await prisma.$queryRaw<ClientEngineerMessageRow[]>`
    SELECT * FROM "ClientEngineerMessage" WHERE "id" = ${id} LIMIT 1
  `;
  return rows[0];
}

