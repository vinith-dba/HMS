import { NextResponse } from "next/server";
import { handler } from "@/lib/api";
import { requireRole } from "@/lib/auth/guard";
import { listDoctors } from "@/server/services/appointments.service";

export const dynamic = "force-dynamic";

export const GET = handler(async (req) => {
  await requireRole(req, "RECEPTIONIST", "ADMIN");
  const doctors = await listDoctors();
  return NextResponse.json({ doctors });
});
