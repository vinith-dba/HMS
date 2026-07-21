import { NextResponse } from "next/server";
import { handler, parseBody } from "@/lib/api";
import { requireRole } from "@/lib/auth/guard";
import { auditContext } from "@/server/services/audit.service";
import { recordPayments } from "@/server/services/billing.service";
import { recordPaymentSchema } from "@/server/validators/labs";
export const dynamic = "force-dynamic";
export const POST = handler(async (req) => {
  const actor = await requireRole(req, "RECEPTIONIST", "LAB_TECH", "PHARMACIST", "ADMIN");
  const input = await parseBody(req, recordPaymentSchema);
  // Single tender or a split (part cash, part UPI) — normalise to a list.
  const payments = input.payments?.length
    ? input.payments
    : [{ mode: input.mode!, amount: input.amount!, reference: input.reference }];
  const invoice = await recordPayments(actor, { invoiceId: input.invoiceId, payments }, auditContext(req));
  return NextResponse.json({ invoice });
});
