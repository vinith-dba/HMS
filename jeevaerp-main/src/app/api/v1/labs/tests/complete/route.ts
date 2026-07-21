import { NextResponse } from "next/server";
import { handler, parseBody, ApiError } from "@/lib/api";
import { requireRole } from "@/lib/auth/guard";
import { auditContext } from "@/server/services/audit.service";
import { completeTest } from "@/server/services/labs.service";
import { z } from "zod";
export const dynamic = "force-dynamic";
export const POST = handler(async (req) => {
  const actor = await requireRole(req, "LAB_TECH", "ADMIN");
  const { labTestId } = await parseBody(req, z.object({ labTestId: z.string().trim().min(1) }));
  const test = await completeTest(actor, labTestId, auditContext(req));
  return NextResponse.json({ test });
});
