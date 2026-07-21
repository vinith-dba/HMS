import { NextResponse } from "next/server";
import { handler } from "@/lib/api";
import { requireRole } from "@/lib/auth/guard";
import { labStats } from "@/server/services/labs.service";
export const dynamic = "force-dynamic";
export const GET = handler(async (req) => {
  await requireRole(req, "LAB_TECH", "ADMIN");
  return NextResponse.json({ stats: await labStats() });
});
