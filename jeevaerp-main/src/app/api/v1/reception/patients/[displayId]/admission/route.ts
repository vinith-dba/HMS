import { NextResponse } from "next/server";
import { handler } from "@/lib/api";
import { requireRole } from "@/lib/auth/guard";
import { activeAdmissionFor } from "@/server/services/ipd.service";

export const dynamic = "force-dynamic";

/**
 * "Is this patient admitted?" — returns the live admission, or null.
 *
 * The segment is named [displayId] because Next.js requires one slug name per
 * path position and the sibling routes already claim it. But callers legitimately
 * hold either form: the search box has a UHID, the inpatient picker has the
 * internal id. So the lookup accepts both rather than making the frontend care.
 *
 * Labs and pharmacy need to ask this too, so they're allowed to.
 */
export const GET = handler(async (req, ctx) => {
  await requireRole(req, "RECEPTIONIST", "LAB_TECH", "PHARMACIST", "ADMIN");
  const { displayId } = await ctx.params;
  const admission = await activeAdmissionFor(displayId);
  return NextResponse.json({ admission });
});
