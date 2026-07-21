import { NextResponse } from "next/server";
import { handler } from "@/lib/api";
import { requireRole } from "@/lib/auth/guard";
import { getPatientByDisplayId } from "@/server/services/reception.service";
import { listPatientPrescriptions } from "@/server/services/prescriptions.service";
export const dynamic = "force-dynamic";
export const GET = handler(async (req, ctx) => {
  await requireRole(req, "RECEPTIONIST", "ADMIN");
  const { displayId } = await ctx.params;
  const patient = await getPatientByDisplayId(displayId.toUpperCase());
  const prescriptions = await listPatientPrescriptions(patient.id);
  return NextResponse.json({ prescriptions });
});
