import { NextResponse } from "next/server";
import { handler } from "@/lib/api";
import { requireRole } from "@/lib/auth/guard";
import { listStaffSessions } from "@/server/services/auth.service";

export const dynamic = "force-dynamic";

/** Recent staff sign-in sessions — login/logout times and duration. Admin only. */
export const GET = handler(async (req) => {
  await requireRole(req, "ADMIN");
  return NextResponse.json({ sessions: await listStaffSessions(150) });
});
