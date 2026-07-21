import { NextResponse } from "next/server";
import { handler, parseBody } from "@/lib/api";
import { requireRole } from "@/lib/auth/guard";
import { auditContext } from "@/server/services/audit.service";
import { listStaff, createStaff } from "@/server/services/admin.service";
import { createStaffSchema } from "@/server/validators/admin";
export const dynamic = "force-dynamic";

export const GET = handler(async (req) => {
  await requireRole(req, "ADMIN");
  return NextResponse.json({ staff: await listStaff() });
});

export const POST = handler(async (req) => {
  const actor = await requireRole(req, "ADMIN");
  const i = await parseBody(req, createStaffSchema);
  const staff = await createStaff(actor, { ...i, email: i.email || undefined }, auditContext(req));
  return NextResponse.json({ staff }, { status: 201 });
});
