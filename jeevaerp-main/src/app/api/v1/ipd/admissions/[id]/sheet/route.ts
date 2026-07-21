import { NextResponse } from "next/server";
import { handler } from "@/lib/api";
import { requireRole } from "@/lib/auth/guard";
import { admissionSheet } from "@/server/services/ipd.service";

export const dynamic = "force-dynamic";

/** The running tab: bed so far + every charge + live total. */
export const GET = handler(async (req, ctx) => {
  await requireRole(req, "RECEPTIONIST", "ADMIN", "DOCTOR");
  const { id } = await ctx.params;
  return NextResponse.json(await admissionSheet(id));
});
