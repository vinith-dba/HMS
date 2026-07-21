import { NextResponse } from "next/server";
import { handler, parseBody } from "@/lib/api";
import { requireRole } from "@/lib/auth/guard";
import { getInvoice, updateInvoice } from "@/server/services/billing.service";
import { updateInvoiceSchema } from "@/server/validators/labs";
import { auditContext } from "@/server/services/audit.service";
export const dynamic = "force-dynamic";
export const GET = handler(async (req, ctx) => {
  await requireRole(req, "RECEPTIONIST", "LAB_TECH", "PHARMACIST", "ADMIN");
  const { id } = await ctx.params;
  return NextResponse.json({ invoice: await getInvoice(id) });
});

/** Edit an UNPAID invoice's items/discount. Paid invoices must be cancelled instead. */
export const PATCH = handler(async (req, ctx) => {
  const actor = await requireRole(req, "RECEPTIONIST", "LAB_TECH", "PHARMACIST", "ADMIN");
  const { id } = await ctx.params;
  const body = await parseBody(req, updateInvoiceSchema.omit({ invoiceId: true }));
  const invoice = await updateInvoice(actor, { invoiceId: id, ...body }, auditContext(req));
  return NextResponse.json({ invoice });
});
