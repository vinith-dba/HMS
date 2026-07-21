import { NextResponse } from "next/server";
import { handler, ApiError } from "@/lib/api";
import { requireRole } from "@/lib/auth/guard";
import { listAvailableSlots } from "@/server/services/appointments.service";

export const dynamic = "force-dynamic";

export const GET = handler(async (req) => {
  await requireRole(req, "RECEPTIONIST", "ADMIN");
  const { searchParams } = new URL(req.url);
  const doctorId = searchParams.get("doctorId");
  const date = searchParams.get("date");
  if (!doctorId || !date) throw new ApiError(400, "doctorId and date are required");
  const slots = await listAvailableSlots(doctorId, date);
  return NextResponse.json({ slots });
});
