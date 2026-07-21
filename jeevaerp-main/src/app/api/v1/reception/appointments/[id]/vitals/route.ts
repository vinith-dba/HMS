import { NextResponse } from "next/server";
import { handler, parseBody } from "@/lib/api";
import { requireRole } from "@/lib/auth/guard";
import { auditContext } from "@/server/services/audit.service";
import { getVitals, recordVitals } from "@/server/services/appointments.service";
import { recordVitalsSchema } from "@/server/validators/reception";

export const dynamic = "force-dynamic";

/** GET = whatever's been typed in for this visit so far (or null). */
export const GET = handler(async (req, ctx) => {
  await requireRole(req, "RECEPTIONIST", "ADMIN", "DOCTOR");
  const { id } = await ctx.params;
  return NextResponse.json({ vitals: await getVitals(id) });
});

/** PUT = save/overwrite the vitals typed in from the doctor's handwritten sheet. */
export const PUT = handler(async (req, ctx) => {
  const actor = await requireRole(req, "RECEPTIONIST", "ADMIN", "DOCTOR");
  const { id } = await ctx.params;
  const input = await parseBody(req, recordVitalsSchema);
  return NextResponse.json(await recordVitals(actor, id, input, auditContext(req)));
});