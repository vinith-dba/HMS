import { NextResponse } from "next/server";
import { handler } from "@/lib/api";
import { requireRole } from "@/lib/auth/guard";
import { auditContext } from "@/server/services/audit.service";
import { setupStandardWards } from "@/server/services/ipd.service";

export const dynamic = "force-dynamic";

/** Create the standard ward/bed layout. Idempotent — safe to press twice. */
export const POST = handler(async (req) => {
  const actor = await requireRole(req, "ADMIN");
  return NextResponse.json(await setupStandardWards(actor, auditContext(req)));
});
