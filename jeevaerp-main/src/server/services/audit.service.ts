import { prisma } from "@/lib/prisma";
import type { AuthUser } from "@/lib/auth/types";
import type { Prisma } from "@prisma/client";

/**
 * Append an audit-trail row. Staff actions set actorUserId; patient actions
 * set actorPatientId (exactly one, per the schema). Best-effort and never
 * throws into the caller — an audit failure must not break the real action.
 */
export async function logAudit(
  actor: AuthUser,
  entry: {
    action: string;
    targetTable: string;
    targetId: string;
    meta?: Prisma.InputJsonValue;
    ipAddress?: string;
    userAgent?: string;
  },
  tx?: Prisma.TransactionClient
): Promise<void> {
  const db = tx ?? prisma;
  try {
    await db.auditLog.create({
      data: {
        action: entry.action,
        targetTable: entry.targetTable,
        targetId: entry.targetId,
        meta: entry.meta,
        ipAddress: entry.ipAddress,
        userAgent: entry.userAgent,
        ...(actor.role === "PATIENT"
          ? { actorPatientId: actor.id }
          : { actorUserId: actor.id }),
      },
    });
  } catch (err) {
    console.error("[audit] failed to write log:", err);
  }
}

/** Pulls client IP + UA from a request for audit context. */
export function auditContext(req: Request): { ipAddress?: string; userAgent?: string } {
  const xff = req.headers.get("x-forwarded-for");
  return {
    ipAddress: xff?.split(",")[0]?.trim() || undefined,
    userAgent: req.headers.get("user-agent") || undefined,
  };
}
