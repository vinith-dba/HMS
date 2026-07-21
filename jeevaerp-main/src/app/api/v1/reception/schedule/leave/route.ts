import { NextResponse } from "next/server";
import { handler, parseBody } from "@/lib/api";
import { requireRole } from "@/lib/auth/guard";
import { auditContext } from "@/server/services/audit.service";
import { setDoctorLeave, clearDoctorLeave } from "@/server/services/appointments.service";
import { doctorLeaveSchema, clearLeaveSchema } from "@/server/validators/reception";

export const dynamic = "force-dynamic";

/** POST = doctor is away. Blocks free slots, returns who already booked. */
export const POST = handler(async (req) => {
  const actor = await requireRole(req, "RECEPTIONIST", "ADMIN");
  const input = await parseBody(req, doctorLeaveSchema);
  return NextResponse.json(await setDoctorLeave(actor, input, auditContext(req)));
});

/** DELETE = doctor is back. */
export const DELETE = handler(async (req) => {
  const actor = await requireRole(req, "RECEPTIONIST", "ADMIN");
  const input = await parseBody(req, clearLeaveSchema);
  return NextResponse.json(await clearDoctorLeave(actor, input, auditContext(req)));
});
