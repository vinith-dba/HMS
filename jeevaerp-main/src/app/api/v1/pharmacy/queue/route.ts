import { NextResponse } from "next/server";
import { handler } from "@/lib/api";
import { requireRole } from "@/lib/auth/guard";
import { pharmacyRxQueue } from "@/server/services/pharmacy.service";
export const dynamic = "force-dynamic";
export const GET = handler(async (req) => {
  await requireRole(req, "PHARMACIST", "ADMIN");
  const { searchParams } = new URL(req.url);
  const s = searchParams.get("status");
  const status = s === "DISPENSED" ? "DISPENSED" : "SENT_TO_PHARMACY";
  return NextResponse.json({ queue: await pharmacyRxQueue(status) });
});
