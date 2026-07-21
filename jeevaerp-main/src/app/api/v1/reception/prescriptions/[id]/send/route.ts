import { NextResponse } from "next/server";
import { handler } from "@/lib/api";
import { requireRole } from "@/lib/auth/guard";
import { auditContext } from "@/server/services/audit.service";
import { sendToPharmacy, recallFromPharmacy } from "@/server/services/prescriptions.service";
export const dynamic = "force-dynamic";

/** Dispatch a scanned handwritten prescription to the pharmacy queue. */
export const POST = handler(async (req, ctx) => {
  const actor = await requireRole(req, "RECEPTIONIST", "ADMIN");
  const { id } = await ctx.params;
  await sendToPharmacy(actor, id, auditContext(req));
  return NextResponse.json({ ok: true });
});

/** Pull it back out of the queue (sent by mistake). */
export const DELETE = handler(async (req, ctx) => {
  const actor = await requireRole(req, "RECEPTIONIST", "ADMIN");
  const { id } = await ctx.params;
  await recallFromPharmacy(actor, id, auditContext(req));
  return NextResponse.json({ ok: true });
});
