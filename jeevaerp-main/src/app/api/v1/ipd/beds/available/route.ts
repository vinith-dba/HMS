import { NextResponse } from "next/server";
import { handler } from "@/lib/api";
import { requireRole } from "@/lib/auth/guard";
import { availableBeds } from "@/server/services/ipd.service";

export const dynamic = "force-dynamic";

/** Wards with only their free beds — feeds the admit form's dropdowns. */
export const GET = handler(async (req) => {
  await requireRole(req, "RECEPTIONIST", "ADMIN");
  return NextResponse.json({ wards: await availableBeds() });
});
