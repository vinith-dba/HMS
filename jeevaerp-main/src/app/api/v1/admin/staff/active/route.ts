import { NextResponse } from "next/server";
import { handler, parseBody } from "@/lib/api";
import { requireRole } from "@/lib/auth/guard";
import { auditContext } from "@/server/services/audit.service";
import { setStaffActive } from "@/server/services/admin.service";
import { setStaffActiveSchema } from "@/server/validators/admin";
export const dynamic = "force-dynamic";
export const POST = handler(async (req) => {
  const actor = await requireRole(req, "ADMIN");
  const input = await parseBody(req, setStaffActiveSchema);
  await setStaffActive(actor, input, auditContext(req));
  return NextResponse.json({ ok: true });
});
