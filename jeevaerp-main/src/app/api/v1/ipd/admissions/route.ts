import { NextResponse } from "next/server";
import { handler, parseBody } from "@/lib/api";
import { requireRole } from "@/lib/auth/guard";
import { auditContext } from "@/server/services/audit.service";
import { admitPatient, currentInpatients } from "@/server/services/ipd.service";
import { admitSchema } from "@/server/validators/ipd";
export const dynamic = "force-dynamic";

export const GET = handler(async (req) => {
  await requireRole(req, "RECEPTIONIST", "ADMIN", "DOCTOR");
  return NextResponse.json({ inpatients: await currentInpatients() });
});

/** Admit: patient by Jeeva ID, onto an AVAILABLE bed, under a doctor. */
export const POST = handler(async (req) => {
  const actor = await requireRole(req, "RECEPTIONIST", "ADMIN");
  const i = await parseBody(req, admitSchema);
  const result = await admitPatient(actor, {
    patientDisplayId: i.patientDisplayId,
    bedId: i.bedId,
    doctorId: i.doctorId,
    reason: i.reason || undefined,
    attendantName: i.attendantName || undefined,
    attendantPhone: i.attendantPhone || undefined,
    attendantRelation: i.attendantRelation || undefined,
    notes: i.notes || undefined,
  }, auditContext(req));
  return NextResponse.json(result, { status: 201 });
});
