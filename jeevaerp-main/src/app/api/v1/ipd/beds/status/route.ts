import { NextResponse } from "next/server";
import { handler, parseBody } from "@/lib/api";
import { requireRole } from "@/lib/auth/guard";
import { auditContext } from "@/server/services/audit.service";
import { setBedStatus } from "@/server/services/ipd.service";
import { bedStatusSchema } from "@/server/validators/ipd";
export const dynamic = "force-dynamic";
export const POST = handler(async (req) => {
  const actor = await requireRole(req, "ADMIN");
  const i = await parseBody(req, bedStatusSchema);
  await setBedStatus(actor, i, auditContext(req));
  return NextResponse.json({ ok: true });
});
