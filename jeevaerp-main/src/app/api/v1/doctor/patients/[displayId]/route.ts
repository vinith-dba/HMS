import { NextResponse } from "next/server";
import { handler } from "@/lib/api";
import { requireRole } from "@/lib/auth/guard";
import { doctorPatientChart } from "@/server/services/doctor.service";
export const dynamic = "force-dynamic";
export const GET = handler(async (req, ctx) => {
  const actor = await requireRole(req, "DOCTOR");
  const { displayId } = await ctx.params;
  return NextResponse.json(await doctorPatientChart(actor, displayId.toUpperCase()));
});
