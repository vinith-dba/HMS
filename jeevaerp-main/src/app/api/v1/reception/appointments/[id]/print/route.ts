import { NextResponse } from "next/server";
import { handler } from "@/lib/api";
import { requireRole } from "@/lib/auth/guard";
import { opdPrintData } from "@/server/services/appointments.service";

export const dynamic = "force-dynamic";

/** Data bundle for the printed OPD prescription sheet. */
export const GET = handler(async (req, ctx) => {
  await requireRole(req, "RECEPTIONIST", "ADMIN", "DOCTOR");
  const { id } = await ctx.params;
  return NextResponse.json(await opdPrintData(id));
});
