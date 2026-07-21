import { NextResponse } from "next/server";
import { handler, parseBody } from "@/lib/api";
import { requireRole } from "@/lib/auth/guard";
import { auditContext } from "@/server/services/audit.service";
import { cancelInvoice } from "@/server/services/billing.service";
import { cancelInvoiceSchema } from "@/server/validators/labs";
export const dynamic = "force-dynamic";

/** Cancel an invoice (never deleted — kept in the ledger, tests released). */
export const POST = handler(async (req, ctx) => {
  const actor = await requireRole(req, "RECEPTIONIST", "LAB_TECH", "PHARMACIST", "ADMIN");
  const { id } = await ctx.params;
  const { reason } = await parseBody(req, cancelInvoiceSchema);
  const invoice = await cancelInvoice(actor, { invoiceId: id, reason }, auditContext(req));
  return NextResponse.json({ invoice });
});
