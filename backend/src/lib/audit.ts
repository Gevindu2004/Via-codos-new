import { prisma } from "./prisma";

interface AuditParams {
  actorId?: string | null;
  actorEmail: string;
  actorRole: string;
  action: string;
  entityType: string;
  entityId: string;
  entityLabel: string;
  summary: string;
  before?: unknown;
  after?: unknown;
  ipAddress?: string | null;
}

export async function recordAuditLog(params: AuditParams) {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: params.actorId ?? null,
        actorEmail: params.actorEmail,
        actorRole: params.actorRole,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        entityLabel: params.entityLabel,
        summary: params.summary,
        beforeJson: params.before !== undefined ? JSON.stringify(params.before) : null,
        afterJson: params.after !== undefined ? JSON.stringify(params.after) : null,
        ipAddress: params.ipAddress ?? null,
      },
    });
  } catch (err) {
    console.error("Failed to record audit log:", err);
  }
}

export async function saveContentVersion(params: {
  entityType: string;
  entityId: string;
  snapshot: unknown;
  changeNote?: string;
  createdByEmail: string;
}) {
  const latest = await prisma.contentVersion.findFirst({
    where: { entityType: params.entityType, entityId: params.entityId },
    orderBy: { versionNumber: "desc" },
  });
  const nextVersion = (latest?.versionNumber ?? 0) + 1;
  return prisma.contentVersion.create({
    data: {
      entityType: params.entityType,
      entityId: params.entityId,
      versionNumber: nextVersion,
      snapshotJson: JSON.stringify(params.snapshot),
      changeNote: params.changeNote ?? `Version ${nextVersion}`,
      createdByEmail: params.createdByEmail,
    },
  });
}

