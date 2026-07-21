import { NextResponse } from "next/server";
import { handler, parseBody } from "@/lib/api";
import { requireRole } from "@/lib/auth/guard";
import { auditContext } from "@/server/services/audit.service";
import { orderTests } from "@/server/services/labs.service";
import { orderTestsSchema } from "@/server/validators/labs";
export const dynamic = "force-dynamic";
export const POST = handler(async (req) => {
  const actor = await requireRole(req, "LAB_TECH", "RECEPTIONIST", "ADMIN");
  const input = await parseBody(req, orderTestsSchema);
  const tests = await orderTests(actor, input, auditContext(req));
  return NextResponse.json({ tests }, { status: 201 });
});
