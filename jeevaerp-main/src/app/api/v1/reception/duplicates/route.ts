import { NextResponse } from "next/server";
import { handler, parseBody } from "@/lib/api";
import { requireRole } from "@/lib/auth/guard";
import { auditContext } from "@/server/services/audit.service";
import { findDuplicates, mergePatients } from "@/server/services/reception.service";
import { mergePatientsSchema } from "@/server/validators/reception";

export const dynamic = "force-dynamic";

/** Patients sharing a phone number — almost always one person, registered twice. */
export const GET = handler(async (req) => {
  await requireRole(req, "RECEPTIONIST", "ADMIN");
  return NextResponse.json(await findDuplicates());
});

/** Fold one into the other. Irreversible by design. */
export const POST = handler(async (req) => {
  const actor = await requireRole(req, "RECEPTIONIST", "ADMIN");
  const input = await parseBody(req, mergePatientsSchema);
  return NextResponse.json(await mergePatients(actor, input, auditContext(req)));
});
