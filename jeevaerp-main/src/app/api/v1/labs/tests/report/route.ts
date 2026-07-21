import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/lib/auth/guard";
import { ApiError } from "@/lib/api";
import { auditContext } from "@/server/services/audit.service";
import { uploadReport } from "@/server/services/labs.service";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const actor = await requireRole(req, "LAB_TECH", "ADMIN");
    const form = await req.formData();
    const file = form.get("file");
    const labTestId = form.get("labTestId");
    if (!(file instanceof File)) throw new ApiError(400, "No file uploaded");
    if (typeof labTestId !== "string" || !labTestId) throw new ApiError(400, "labTestId is required");

    const buffer = Buffer.from(await file.arrayBuffer());
    const test = await uploadReport(
      actor,
      { labTestId, file: { buffer, fileName: file.name, mimeType: file.type, size: file.size } },
      auditContext(req)
    );
    return NextResponse.json({ test }, { status: 201 });
  } catch (err) {
    if (err instanceof ApiError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("[lab report upload] error:", err);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
