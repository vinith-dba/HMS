import { NextResponse } from "next/server";
import { handler, ApiError } from "@/lib/api";
import { requireRole } from "@/lib/auth/guard";
import { doctorDaySchedule } from "@/server/services/appointments.service";

export const dynamic = "force-dynamic";

export const GET = handler(async (req) => {
  await requireRole(req, "RECEPTIONIST", "ADMIN");
  const doctorId = req.nextUrl.searchParams.get("doctorId");
  const date = req.nextUrl.searchParams.get("date");
  if (!doctorId || !date) throw new ApiError(400, "doctorId and date are required");
  return NextResponse.json(await doctorDaySchedule(doctorId, date));
});
