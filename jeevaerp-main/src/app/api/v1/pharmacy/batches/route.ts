import { NextResponse } from "next/server";
import { handler, parseBody } from "@/lib/api";
import { requireRole } from "@/lib/auth/guard";
import { auditContext } from "@/server/services/audit.service";
import { addBatch } from "@/server/services/pharmacy.service";
import { addBatchSchema } from "@/server/validators/pharmacy";
export const dynamic = "force-dynamic";
export const POST = handler(async (req) => {
  const actor = await requireRole(req, "PHARMACIST", "ADMIN");
  const input = await parseBody(req, addBatchSchema);
  await addBatch(actor, input, auditContext(req));
  return NextResponse.json({ ok: true }, { status: 201 });
});
