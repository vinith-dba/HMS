import { NextResponse } from "next/server";
import { handler } from "@/lib/api";
import { requireRole } from "@/lib/auth/guard";
import { recentPatients } from "@/server/services/reception.service";

export const dynamic = "force-dynamic";

export const GET = handler(async (req) => {
  await requireRole(req, "RECEPTIONIST", "LAB_TECH", "PHARMACIST", "ADMIN");
  const patients = await recentPatients(8);
  return NextResponse.json({ patients });
});
