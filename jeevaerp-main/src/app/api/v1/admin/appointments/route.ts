import { NextResponse } from "next/server";
import { handler } from "@/lib/api";
import { requireRole } from "@/lib/auth/guard";
import { adminAppointmentHistory } from "@/server/services/appointments.service";

export const dynamic = "force-dynamic";

/** Full appointment history WITH referral attribution — ADMIN ONLY. */
export const GET = handler(async (req) => {
  await requireRole(req, "ADMIN");
  const appointments = await adminAppointmentHistory(100);
  return NextResponse.json({ appointments });
});
