import { NextResponse } from "next/server";
import { handler, parseBody } from "@/lib/api";
import { requireRole } from "@/lib/auth/guard";
import { auditContext } from "@/server/services/audit.service";
import { bookAppointment, todaysAppointments } from "@/server/services/appointments.service";
import { bookAppointmentSchema } from "@/server/validators/reception";

export const dynamic = "force-dynamic";

/** Book an appointment for a patient with a doctor (atomic slot claim). */
export const POST = handler(async (req) => {
  const actor = await requireRole(req, "RECEPTIONIST", "ADMIN");
  const input = await parseBody(req, bookAppointmentSchema);
  const appointment = await bookAppointment(actor, input, auditContext(req));
  return NextResponse.json({ appointment }, { status: 201 });
});

/** Today's appointment queue. */
export const GET = handler(async (req) => {
  await requireRole(req, "RECEPTIONIST", "ADMIN");
  const appointments = await todaysAppointments();
  return NextResponse.json({ appointments });
});
