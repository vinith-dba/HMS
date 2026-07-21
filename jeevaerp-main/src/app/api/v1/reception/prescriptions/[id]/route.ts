import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/lib/auth/guard";
import { handler, ApiError } from "@/lib/api";
import { auditContext } from "@/server/services/audit.service";
import { replacePrescriptionFile, deletePrescription } from "@/server/services/prescriptions.service";
export const dynamic = "force-dynamic";

/** Replace the file and/or title on an existing prescription (multipart). */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireRole(req, "RECEPTIONIST", "ADMIN");
    const { id } = await ctx.params;
    const form = await req.formData();
    const file = form.get("file");
    const title = form.get("title");

    const payload: Parameters<typeof replacePrescriptionFile>[1] = { id };
    if (typeof title === "string") payload.title = title;
    if (file instanceof File) {
      payload.file = { buffer: Buffer.from(await file.arrayBuffer()), fileName: file.name, mimeType: file.type, size: file.size };
    }
    const prescription = await replacePrescriptionFile(actor, payload, auditContext(req));
    return NextResponse.json({ prescription });
  } catch (err) {
    if (err instanceof ApiError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("[prescription replace] error:", err);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}

/** Delete a prescription upload. */
export const DELETE = handler(async (req, ctx) => {
  const actor = await requireRole(req, "RECEPTIONIST", "ADMIN");
  const { id } = await ctx.params;
  await deletePrescription(actor, id, auditContext(req));
  return NextResponse.json({ ok: true });
});
