import { NextResponse } from "next/server";
import { handler, parseBody } from "@/lib/api";
import { requireRole } from "@/lib/auth/guard";
import { auditContext } from "@/server/services/audit.service";
import { cancelAppointment } from "@/server/services/appointments.service";
import { cancelAppointmentSchema } from "@/server/validators/reception";

export const dynamic = "force-dynamic";

export const POST = handler(async (req, ctx) => {
  const actor = await requireRole(req, "RECEPTIONIST", "ADMIN");
  const { id } = await ctx.params;
  const { reason } = await parseBody(req, cancelAppointmentSchema);
  return NextResponse.json(await cancelAppointment(actor, { appointmentId: id, reason }, auditContext(req)));
});
