import { NextResponse } from "next/server";
import { handler, parseBody } from "@/lib/api";
import { requireRole } from "@/lib/auth/guard";
import { auditContext } from "@/server/services/audit.service";
import { refundInvoice } from "@/server/services/billing.service";
import { refundSchema } from "@/server/validators/reception";

export const dynamic = "force-dynamic";

/** Give money back. The single most dangerous write in the ERP. */
export const POST = handler(async (req, ctx) => {
  const actor = await requireRole(req, "RECEPTIONIST", "ADMIN");
  const { id } = await ctx.params;
  const input = await parseBody(req, refundSchema);
  const result = await refundInvoice(actor, { invoiceId: id, ...input }, auditContext(req));
  return NextResponse.json(result);
});
