import { NextResponse } from "next/server";
import { handler, parseBody } from "@/lib/api";
import { requireRole } from "@/lib/auth/guard";
import { auditContext } from "@/server/services/audit.service";
import { transferBed, transferTargets } from "@/server/services/ipd.service";
import { transferBedSchema } from "@/server/validators/ipd";

export const dynamic = "force-dynamic";

/** Beds this patient could move into. */
export const GET = handler(async (req, ctx) => {
  await requireRole(req, "RECEPTIONIST", "ADMIN");
  const { id } = await ctx.params;
  return NextResponse.json(await transferTargets(id));
});

/** Move them. Closes the current bed-stay leg, opens a new one at the new rate. */
export const POST = handler(async (req, ctx) => {
  const actor = await requireRole(req, "RECEPTIONIST", "ADMIN");
  const { id } = await ctx.params;
  const input = await parseBody(req, transferBedSchema);
  const result = await transferBed(actor, { admissionId: id, ...input }, auditContext(req));
  return NextResponse.json(result);
});
