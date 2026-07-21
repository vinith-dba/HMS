import { NextResponse } from "next/server";
import { handler, parseBody } from "@/lib/api";
import { requireRole } from "@/lib/auth/guard";
import { auditContext } from "@/server/services/audit.service";
import { dispense } from "@/server/services/pharmacy.service";
import { dispenseSchema } from "@/server/validators/pharmacy";
export const dynamic = "force-dynamic";
export const POST = handler(async (req) => {
  const actor = await requireRole(req, "PHARMACIST", "ADMIN");
  const input = await parseBody(req, dispenseSchema);
  const result = await dispense(actor, input, auditContext(req));
  return NextResponse.json(result, { status: 201 });
});
