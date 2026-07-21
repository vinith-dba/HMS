import { NextResponse } from "next/server";
import { handler, parseBody } from "@/lib/api";
import { requireRole } from "@/lib/auth/guard";
import { auditContext } from "@/server/services/audit.service";
import { addBeds } from "@/server/services/ipd.service";
import { addBedsSchema } from "@/server/validators/ipd";
export const dynamic = "force-dynamic";
export const POST = handler(async (req) => {
  const actor = await requireRole(req, "ADMIN");
  const i = await parseBody(req, addBedsSchema);
  await addBeds(actor, { wardId: i.wardId, count: i.count, prefix: i.prefix || undefined }, auditContext(req));
  return NextResponse.json({ ok: true }, { status: 201 });
});
