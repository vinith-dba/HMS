import { NextResponse } from "next/server";
import { handler } from "@/lib/api";
import { requireRole } from "@/lib/auth/guard";
import { searchPatients } from "@/server/services/reception.service";

export const dynamic = "force-dynamic";

/** Patient lookup for raising a claim. Admin only. */
export const GET = handler(async (req) => {
  await requireRole(req, "ADMIN");
  const q = new URL(req.url).searchParams.get("q") ?? "";
  const patients = await searchPatients(q, 8);
  return NextResponse.json({ patients });
});
