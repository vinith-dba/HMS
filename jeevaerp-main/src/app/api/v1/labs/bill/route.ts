import { NextResponse } from "next/server";
import { handler, parseBody } from "@/lib/api";
import { requireRole } from "@/lib/auth/guard";
import { auditContext } from "@/server/services/audit.service";
import { billLabTests } from "@/server/services/labs.service";
import { billLabTestsSchema } from "@/server/validators/labs";
export const dynamic = "force-dynamic";
export const POST = handler(async (req) => {
  const actor = await requireRole(req, "LAB_TECH", "RECEPTIONIST", "ADMIN");
  const input = await parseBody(req, billLabTestsSchema);
  const invoice = await billLabTests(actor, input, auditContext(req));
  return NextResponse.json({ invoice }, { status: 201 });
});
