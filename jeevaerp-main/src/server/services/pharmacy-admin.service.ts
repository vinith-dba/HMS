import { prisma } from "@/lib/prisma";
import { logAudit } from "./audit.service";
import type { AuthUser } from "@/lib/auth/types";

/**
 * Create or edit a medicine. This is where the GST rate is set —
 * medicines ARE taxable in India (commonly 5%, some at 12%), unlike
 * diagnostic services which are exempt.
 */
export async function upsertMedicine(
  actor: AuthUser,
  input: {
    id?: string; name: string; genericName?: string; manufacturer?: string;
    hsnCode?: string; gstRatePct: number; unit: string;
    reorderThreshold: number; rackLocation?: string; active: boolean; courseCritical?: boolean;
  },
  ctx: { ipAddress?: string; userAgent?: string }
): Promise<void> {
  const data = {
    name: input.name,
    genericName: input.genericName || null,
    manufacturer: input.manufacturer || null,
    hsnCode: input.hsnCode || null,
    gstRatePct: input.gstRatePct.toFixed(2),
    unit: input.unit,
    reorderThreshold: input.reorderThreshold,
    rackLocation: input.rackLocation || null,
    active: input.active,
    courseCritical: input.courseCritical ?? false,
  };

  if (input.id) {
    await prisma.medicine.update({ where: { id: input.id }, data });
    await logAudit(actor, { action: "MEDICINE_UPDATED", targetTable: "Medicine", targetId: input.id, meta: { gstRatePct: input.gstRatePct }, ...ctx });
  } else {
    const created = await prisma.medicine.create({ data, select: { id: true } });
    await logAudit(actor, { action: "MEDICINE_CREATED", targetTable: "Medicine", targetId: created.id, ...ctx });
  }
}
