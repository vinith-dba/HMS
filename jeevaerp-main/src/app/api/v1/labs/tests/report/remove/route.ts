import { NextResponse } from "next/server";
import { handler, parseBody } from "@/lib/api";
import { requireRole } from "@/lib/auth/guard";
import { auditContext } from "@/server/services/audit.service";
import { removeReport } from "@/server/services/labs.service";
import { z } from "zod";
export const dynamic = "force-dynamic";

/** Remove a report file and reopen the test. */
export const POST = handler(async (req) => {
  const actor = await requireRole(req, "LAB_TECH", "ADMIN");
  const { labTestId } = await parseBody(req, z.object({ labTestId: z.string().trim().min(1) }));
  const test = await removeReport(actor, labTestId, auditContext(req));
  return NextResponse.json({ test });
});
