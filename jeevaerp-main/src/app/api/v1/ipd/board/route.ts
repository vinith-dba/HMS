import { NextResponse } from "next/server";
import { handler } from "@/lib/api";
import { requireRole } from "@/lib/auth/guard";
import { bedBoard } from "@/server/services/ipd.service";
export const dynamic = "force-dynamic";
export const GET = handler(async (req) => {
  await requireRole(req, "RECEPTIONIST", "ADMIN", "DOCTOR");
  return NextResponse.json(await bedBoard());
});
