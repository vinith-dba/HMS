import { NextResponse } from "next/server";
import { handler, parseBody } from "@/lib/api";
import { requireRole } from "@/lib/auth/guard";
import { auditContext } from "@/server/services/audit.service";
import { toggleSlotBlock } from "@/server/services/appointments.service";
import { toggleSlotSchema } from "@/server/validators/reception";

export const dynamic = "force-dynamic";

export const POST = handler(async (req) => {
  const actor = await requireRole(req, "RECEPTIONIST", "ADMIN");
  const input = await parseBody(req, toggleSlotSchema);
  await toggleSlotBlock(actor, input, auditContext(req));
  return NextResponse.json({ ok: true });
});
