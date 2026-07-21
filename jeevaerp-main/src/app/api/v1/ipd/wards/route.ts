import { NextResponse } from "next/server";
import { handler, parseBody } from "@/lib/api";
import { requireRole } from "@/lib/auth/guard";
import { auditContext } from "@/server/services/audit.service";
import { upsertWard } from "@/server/services/ipd.service";
import { wardSchema } from "@/server/validators/ipd";
export const dynamic = "force-dynamic";

/** Ward setup is admin-only — it sets money (the daily charge). */
export const POST = handler(async (req) => {
  const actor = await requireRole(req, "ADMIN");
  const i = await parseBody(req, wardSchema);
  await upsertWard(actor, { ...i, floor: i.floor || undefined }, auditContext(req));
  return NextResponse.json({ ok: true }, { status: 201 });
});
