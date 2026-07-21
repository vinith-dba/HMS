import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/guard";
import { ApiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { readStoredFile, fileUrlForKey } from "@/lib/storage";

export const dynamic = "force-dynamic";

/** Roles that may read any patient's prescription scan. */
const CLINICAL_ROLES = ["RECEPTIONIST", "PHARMACIST", "DOCTOR", "ADMIN"];

/**
 * Streams a prescription scan.
 *
 * These are patient health records, so they are NOT in /public. Every read goes
 * through this gate:
 *   - clinical staff  -> any scan
 *   - a patient       -> only their own scans
 *   - anyone else     -> 401/403
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ key: string }> }) {
  try {
    const user = await requireAuth(req);
    const { key } = await ctx.params;

    const upload = await prisma.prescriptionUpload.findFirst({
      where: { fileUrl: fileUrlForKey(key) },
      select: { id: true, patientId: true, mimeType: true, fileName: true },
    });
    if (!upload) throw new ApiError(404, "File not found");

    // Patients may only open their own prescriptions.
    if (!CLINICAL_ROLES.includes(user.role)) {
      if (user.role !== "PATIENT" || user.id !== upload.patientId) {
        throw new ApiError(403, "Not permitted to view this file");
      }
    }

    const buffer = await readStoredFile(key);

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": upload.mimeType || "application/octet-stream",
        // inline so the pharmacist can just look at it in the tab
        "Content-Disposition": `inline; filename="${encodeURIComponent(upload.fileName)}"`,
        // never let a shared proxy or the browser cache a medical record
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    // A missing file on disk lands here — don't leak the path.
    console.error("[file serve] error:", err);
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
}
