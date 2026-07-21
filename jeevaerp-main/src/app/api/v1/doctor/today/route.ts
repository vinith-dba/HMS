import { NextResponse } from "next/server";
import { handler, parseBody } from "@/lib/api";
import { requireRole } from "@/lib/auth/guard";
import { doctorToday, completeConsultation } from "@/server/services/doctor.service";
import { z } from "zod";
export const dynamic = "force-dynamic";

export const GET = handler(async (req) => {
  const actor = await requireRole(req, "DOCTOR");
  return NextResponse.json(await doctorToday(actor));
});

/** Mark a consultation done. */
export const POST = handler(async (req) => {
  const actor = await requireRole(req, "DOCTOR");
  const { appointmentId } = await parseBody(req, z.object({ appointmentId: z.string().trim().min(1) }));
  await completeConsultation(actor, appointmentId);
  return NextResponse.json({ ok: true });
});
