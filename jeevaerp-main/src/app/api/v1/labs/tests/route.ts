import { NextResponse } from "next/server";
import { handler } from "@/lib/api";
import { requireRole } from "@/lib/auth/guard";
import { listLabTests } from "@/server/services/labs.service";
export const dynamic = "force-dynamic";
export const GET = handler(async (req) => {
  await requireRole(req, "LAB_TECH", "ADMIN");
  const { searchParams } = new URL(req.url);
  const s = searchParams.get("status");
  const status = s === "PENDING" || s === "COMPLETED" ? s : undefined;
  return NextResponse.json({ tests: await listLabTests(status) });
});
