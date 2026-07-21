import { NextResponse } from "next/server";
import { handler } from "@/lib/api";
import { requireRole } from "@/lib/auth/guard";
import { patientLabHistory } from "@/server/services/labs.service";
export const dynamic = "force-dynamic";
export const GET = handler(async (req, ctx) => {
  await requireRole(req, "LAB_TECH", "RECEPTIONIST", "ADMIN");
  const { displayId } = await ctx.params;
  return NextResponse.json(await patientLabHistory(displayId.toUpperCase()));
});
