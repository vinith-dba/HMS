import { NextResponse } from "next/server";
import { handler } from "@/lib/api";
import { requireRole } from "@/lib/auth/guard";
import { dayClose } from "@/server/services/reports.service";

export const dynamic = "force-dynamic";

/** What should physically be in the drawer right now. */
export const GET = handler(async (req) => {
  await requireRole(req, "RECEPTIONIST", "ADMIN");
  const date = new URL(req.url).searchParams.get("date") ?? undefined;
  return NextResponse.json(await dayClose(date));
});
