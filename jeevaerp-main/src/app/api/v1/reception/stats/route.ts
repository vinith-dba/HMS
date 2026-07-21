import { NextResponse } from "next/server";
import { handler } from "@/lib/api";
import { requireRole } from "@/lib/auth/guard";
import { receptionTodayStats } from "@/server/services/appointments.service";

export const dynamic = "force-dynamic";

export const GET = handler(async (req) => {
  await requireRole(req, "RECEPTIONIST", "ADMIN");
  const stats = await receptionTodayStats();
  return NextResponse.json({ stats });
});
