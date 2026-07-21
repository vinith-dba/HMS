import { NextResponse } from "next/server";
import { handler, parseBody, ApiError } from "@/lib/api";
import { requireAuth } from "@/lib/auth/guard";
import { auditContext } from "@/server/services/audit.service";
import { updateOwnContact } from "@/server/services/reception.service";
import { updateOwnContactSchema } from "@/server/validators/reception";
export const dynamic = "force-dynamic";

/** The signed-in patient updates their own contact details. */
export const PATCH = handler(async (req) => {
  const caller = await requireAuth(req);
  if (caller.role !== "PATIENT") throw new ApiError(403, "Patients only");
  const input = await parseBody(req, updateOwnContactSchema);
  const patient = await updateOwnContact(caller.id, input, auditContext(req));
  return NextResponse.json({ patient });
});
