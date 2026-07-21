import { NextResponse } from "next/server";
import { handler, parseBody } from "@/lib/api";
import { requireRole } from "@/lib/auth/guard";
import { auditContext } from "@/server/services/audit.service";
import { addAdvance } from "@/server/services/ipd.service";
import { advanceSchema } from "@/server/validators/ipd";

export const dynamic = "force-dynamic";

/** Take the deposit at admission. Adjusted against the discharge bill. */
export const POST = handler(async (req, ctx) => {
  const actor = await requireRole(req, "RECEPTIONIST", "ADMIN");
  const { id } = await ctx.params;
  const input = await parseBody(req, advanceSchema);
  const result = await addAdvance(actor, { admissionId: id, ...input }, auditContext(req));
  return NextResponse.json(result);
});
