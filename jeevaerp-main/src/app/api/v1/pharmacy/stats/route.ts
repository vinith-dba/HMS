import { NextResponse } from "next/server";
import { handler } from "@/lib/api";
import { requireRole } from "@/lib/auth/guard";
import { pharmacyStats } from "@/server/services/pharmacy.service";
export const dynamic = "force-dynamic";
export const GET = handler(async (req) => {
  await requireRole(req, "PHARMACIST", "ADMIN");
  return NextResponse.json({ stats: await pharmacyStats() });
});
