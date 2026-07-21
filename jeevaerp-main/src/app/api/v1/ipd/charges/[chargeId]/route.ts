import { NextResponse } from "next/server";
import { handler } from "@/lib/api";
import { requireRole } from "@/lib/auth/guard";
import { auditContext } from "@/server/services/audit.service";
import { removeAdmissionCharge } from "@/server/services/ipd.service";

export const dynamic = "force-dynamic";

export const DELETE = handler(async (req, ctx) => {
  const actor = await requireRole(req, "RECEPTIONIST", "ADMIN");
  const { chargeId } = await ctx.params;
  await removeAdmissionCharge(actor, chargeId, auditContext(req));
  return NextResponse.json({ ok: true });
});
