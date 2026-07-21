import { NextResponse } from "next/server";
import { handler } from "@/lib/api";
import { requireRole } from "@/lib/auth/guard";
import { regenerateFutureSlots } from "@/server/services/slots.service";

export const dynamic = "force-dynamic";

/** Rebuild the future booking grid at a 10-minute cadence. Reception/admin. */
export const POST = handler(async (req) => {
  await requireRole(req, "RECEPTIONIST", "ADMIN");
  return NextResponse.json(await regenerateFutureSlots(10, 14));
});
