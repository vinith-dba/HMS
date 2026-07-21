import { NextResponse } from "next/server";
import { handler } from "@/lib/api";
import { requireRole } from "@/lib/auth/guard";
import { getClaim } from "@/server/services/insurance.service";

export const dynamic = "force-dynamic";

/** Full claim with its timeline. Admin only. */
export const GET = handler(async (req, ctx) => {
  await requireRole(req, "ADMIN");
  const { id } = await ctx.params;
  return NextResponse.json({ claim: await getClaim(id) });
});
