import { NextResponse } from "next/server";
import { handler, parseBody } from "@/lib/api";
import { requireRole } from "@/lib/auth/guard";
import { auditContext } from "@/server/services/audit.service";
import { getHospitalConfig, updateHospitalConfig } from "@/server/services/admin.service";
import { hospitalConfigSchema } from "@/server/validators/admin";
export const dynamic = "force-dynamic";

export const GET = handler(async (req) => {
  await requireRole(req, "ADMIN");
  return NextResponse.json({ config: await getHospitalConfig() });
});

export const PUT = handler(async (req) => {
  const actor = await requireRole(req, "ADMIN");
  const i = await parseBody(req, hospitalConfigSchema);
  const config = await updateHospitalConfig(actor, { ...i, gstin: i.gstin || undefined, phone: i.phone || undefined, email: i.email || undefined }, auditContext(req));
  return NextResponse.json({ config });
});
