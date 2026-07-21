import { NextResponse } from "next/server";
import { handler, parseBody } from "@/lib/api";
import { requireRole } from "@/lib/auth/guard";
import { auditContext } from "@/server/services/audit.service";
import { sendOpdSheetToPharmacy } from "@/server/services/prescriptions.service";
import { sendOpdSheetSchema } from "@/server/validators/reception";

export const dynamic = "force-dynamic";

/**
 * Generate the OPD prescription sheet from the entered data and file it as a
 * prescription — optionally dispatching it to the pharmacy queue in one step.
 * No scan required. Reception / admin only.
 */
export const POST = handler(async (req) => {
  const actor = await requireRole(req, "RECEPTIONIST", "ADMIN");
  const i = await parseBody(req, sendOpdSheetSchema);
  const prescription = await sendOpdSheetToPharmacy(
    actor,
    {
      appointmentId: i.appointmentId, items: i.items, title: i.title || undefined, sendNow: i.sendNow,
      diagnosis: i.diagnosis || undefined, advice: i.advice || undefined,
      nextVisit: i.nextVisit || undefined, labs: i.labs,
    },
    auditContext(req)
  );
  return NextResponse.json({ prescription }, { status: 201 });
});
