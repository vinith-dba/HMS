import { NextResponse } from "next/server";
import { handler } from "@/lib/api";
import { requireRole } from "@/lib/auth/guard";
import { adminOverview } from "@/server/services/admin.service";
export const dynamic = "force-dynamic";
export const GET = handler(async (req) => {
  await requireRole(req, "ADMIN");
  return NextResponse.json({ overview: await adminOverview() });
});
