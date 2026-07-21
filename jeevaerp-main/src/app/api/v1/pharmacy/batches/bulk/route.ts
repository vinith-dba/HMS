import { NextResponse } from "next/server";
import { handler, parseBody } from "@/lib/api";
import { requireRole } from "@/lib/auth/guard";
import { auditContext } from "@/server/services/audit.service";
import { bulkAddBatches } from "@/server/services/pharmacy.service";
import { bulkAddBatchesSchema } from "@/server/validators/pharmacy";

export const dynamic = "force-dynamic";

/**
 * Receive many stock batches in one go — from an uploaded spreadsheet or the
 * rows keyed in beside a scanned supplier invoice. Returns a per-row report.
 * Pharmacist / admin only.
 */
export const POST = handler(async (req) => {
  const actor = await requireRole(req, "PHARMACIST", "ADMIN");
  const { rows } = await parseBody(req, bulkAddBatchesSchema);
  const result = await bulkAddBatches(actor, rows, auditContext(req));
  return NextResponse.json(result, { status: 201 });
});
