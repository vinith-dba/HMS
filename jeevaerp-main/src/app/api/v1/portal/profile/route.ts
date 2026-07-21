import { NextResponse } from "next/server";
import { handler, ApiError } from "@/lib/api";
import { requireAuth } from "@/lib/auth/guard";
import { getPatientProfileBundle } from "@/server/services/patient-profile.service";

export const dynamic = "force-dynamic";

/** The signed-in patient's full profile. Patients only. */
export const GET = handler(async (req) => {
  const caller = await requireAuth(req);
  if (caller.role !== "PATIENT") throw new ApiError(403, "Patients only");
  const bundle = await getPatientProfileBundle(caller.id);
  return NextResponse.json(bundle);
});
