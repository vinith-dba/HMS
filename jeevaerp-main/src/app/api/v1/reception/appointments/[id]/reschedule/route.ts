import { NextResponse } from "next/server";
import { handler, parseBody } from "@/lib/api";
import { requireRole } from "@/lib/auth/guard";
import { auditContext } from "@/server/services/audit.service";
import { rescheduleAppointment } from "@/server/services/appointments.service";
import { rescheduleAppointmentSchema } from "@/server/validators/reception";

export const dynamic = "force-dynamic";

export const POST = handler(async (req, ctx) => {
  const actor = await requireRole(req, "RECEPTIONIST", "ADMIN");
  const { id } = await ctx.params;
  const { newSlotId } = await parseBody(req, rescheduleAppointmentSchema);
  return NextResponse.json(await rescheduleAppointment(actor, { appointmentId: id, newSlotId }, auditContext(req)));
});
