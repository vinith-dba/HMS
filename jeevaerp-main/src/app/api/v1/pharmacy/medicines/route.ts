import { NextResponse } from "next/server";
import { handler, parseBody } from "@/lib/api";
import { requireRole } from "@/lib/auth/guard";
import { auditContext } from "@/server/services/audit.service";
import { listMedicines } from "@/server/services/pharmacy.service";
import { upsertMedicine } from "@/server/services/pharmacy-admin.service";
import { medicineSchema } from "@/server/validators/pharmacy";
export const dynamic = "force-dynamic";

export const GET = handler(async (req) => {
  // Reception reads this for autocomplete while transcribing a handwritten
  // prescription. Writes below stay pharmacist/admin-only.
  await requireRole(req, "PHARMACIST", "ADMIN", "RECEPTIONIST");
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim() || undefined;
  return NextResponse.json({ medicines: await listMedicines(q) });
});

/** Add or edit a medicine — this is where the GST rate (5% / 12%) is set. */
export const POST = handler(async (req) => {
  const actor = await requireRole(req, "PHARMACIST", "ADMIN");
  const i = await parseBody(req, medicineSchema);
  await upsertMedicine(actor, {
    ...i,
    genericName: i.genericName || undefined,
    manufacturer: i.manufacturer || undefined,
    hsnCode: i.hsnCode || undefined,
    rackLocation: i.rackLocation || undefined,
  }, auditContext(req));
  return NextResponse.json({ ok: true }, { status: 201 });
});
