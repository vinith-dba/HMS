import { NextResponse } from "next/server";
import { handler, parseBody } from "@/lib/api";
import { requireRole } from "@/lib/auth/guard";
import { auditContext } from "@/server/services/audit.service";
import { actOnClaim } from "@/server/services/insurance.service";
import { claimActionSchema } from "@/server/validators/insurance";

export const dynamic = "force-dynamic";

/** Move a claim along: submit, query, approve, reject, settle, or note. */
export const POST = handler(async (req, ctx) => {
  const actor = await requireRole(req, "ADMIN");
  const { id } = await ctx.params;
  const input = await parseBody(req, claimActionSchema);
  const claim = await actOnClaim(actor, id, input, auditContext(req));
  return NextResponse.json({ claim });
});
