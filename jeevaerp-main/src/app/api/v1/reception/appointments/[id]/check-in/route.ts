import { NextResponse } from "next/server";
import { handler } from "@/lib/api";
import { requireRole } from "@/lib/auth/guard";
import { auditContext } from "@/server/services/audit.service";
import { checkInAppointment, undoCheckIn } from "@/server/services/appointments.service";

export const dynamic = "force-dynamic";

/** POST = patient has arrived. */
export const POST = handler(async (req, ctx) => {
  const actor = await requireRole(req, "RECEPTIONIST", "ADMIN");
  const { id } = await ctx.params;
  return NextResponse.json(await checkInAppointment(actor, id, auditContext(req)));
});

/** DELETE = undo a mis-click. */
export const DELETE = handler(async (req, ctx) => {
  const actor = await requireRole(req, "RECEPTIONIST", "ADMIN");
  const { id } = await ctx.params;
  await undoCheckIn(actor, id, auditContext(req));
  return NextResponse.json({ ok: true });
});
