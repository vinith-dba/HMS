import { NextResponse } from "next/server";
import { handler, parseBody } from "@/lib/api";
import { requireRole } from "@/lib/auth/guard";
import { auditContext } from "@/server/services/audit.service";
import { dischargePatient } from "@/server/services/ipd.service";
import { dischargeSchema } from "@/server/validators/ipd";
import { z } from "zod";
export const dynamic = "force-dynamic";

export const POST = handler(async (req, ctx) => {
  const actor = await requireRole(req, "RECEPTIONIST", "ADMIN");
  const { id } = await ctx.params;
  const body = await parseBody(req, dischargeSchema.omit({ admissionId: true }).extend({ admissionId: z.string().optional() }));
  const result = await dischargePatient(actor, {
    admissionId: id,
    discountAmount: body.discountAmount,
    payment: body.payment,
    payments: body.payments,
    notes: body.notes || undefined,
  }, auditContext(req));
  return NextResponse.json(result);
});
