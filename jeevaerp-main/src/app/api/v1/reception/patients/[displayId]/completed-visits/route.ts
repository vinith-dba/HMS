import { NextResponse } from "next/server";
import { handler } from "@/lib/api";
import { requireRole } from "@/lib/auth/guard";
import { recentCompletedVisits } from "@/server/services/prescriptions.service";
export const dynamic = "force-dynamic";
export const GET = handler(async (req, ctx) => {
  await requireRole(req, "RECEPTIONIST", "ADMIN");
  const { displayId } = await ctx.params;
  return NextResponse.json({ visits: await recentCompletedVisits(displayId) });
});
