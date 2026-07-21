import { NextResponse } from "next/server";
import { handler } from "@/lib/api";
import { requireRole } from "@/lib/auth/guard";
import { getInvoice } from "@/server/services/billing.service";

export const dynamic = "force-dynamic";

/** Full invoice for the printed GST bill — every billing desk can print. */
export const GET = handler(async (req, ctx) => {
  await requireRole(req, "RECEPTIONIST", "ADMIN", "LAB_TECH", "PHARMACIST");
  const { id } = await ctx.params;
  return NextResponse.json({ invoice: await getInvoice(id) });
});
