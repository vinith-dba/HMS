import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/lib/auth/guard";
import { ApiError } from "@/lib/api";
import { auditContext } from "@/server/services/audit.service";
import { uploadPrescription } from "@/server/services/prescriptions.service";

export const dynamic = "force-dynamic";

/** Upload a scanned prescription (multipart/form-data). Reception/admin only. */
export async function POST(req: NextRequest) {
  try {
    const actor = await requireRole(req, "RECEPTIONIST", "ADMIN");

    const form = await req.formData();
    const file = form.get("file");
    const patientId = form.get("patientId");
    const appointmentId = form.get("appointmentId");
  const admissionId = form.get("admissionId");
    const title = form.get("title");
    const sendNow = form.get("sendNow") === "1";
    // typed medicine lines come as a JSON string field
    let items: { medicineName: string; medicineId?: string; qty?: number; dosage?: string }[] = [];
    const rawItems = form.get("items");
    if (typeof rawItems === "string" && rawItems.trim()) {
      try {
        const parsed = JSON.parse(rawItems);
        if (Array.isArray(parsed)) {
          items = parsed
            .filter((x) => x && typeof x.medicineName === "string")
            .slice(0, 30)
            .map((x) => ({
              medicineName: String(x.medicineName).slice(0, 120),
              medicineId: typeof x.medicineId === "string" && x.medicineId ? x.medicineId : undefined,
              qty: Number.isFinite(Number(x.qty)) ? Number(x.qty) : 1,
              dosage: typeof x.dosage === "string" && x.dosage.trim() ? String(x.dosage).slice(0, 120) : undefined,
            }));
        }
      } catch {
        throw new ApiError(400, "Medicine list is not valid");
      }
    }

    if (!(file instanceof File)) throw new ApiError(400, "No file uploaded");
    if (typeof patientId !== "string" || !patientId) throw new ApiError(400, "patientId is required");

    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await uploadPrescription(
      actor,
      {
        patientId,
        appointmentId: typeof appointmentId === "string" && appointmentId ? appointmentId : undefined,
      admissionId: typeof admissionId === "string" && admissionId ? admissionId : undefined,
        title: typeof title === "string" ? title : undefined,
        items,
        sendNow,
        file: { buffer, fileName: file.name, mimeType: file.type, size: file.size },
      },
      auditContext(req)
    );
    return NextResponse.json({ prescription: result }, { status: 201 });
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[prescription upload] error:", err);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
