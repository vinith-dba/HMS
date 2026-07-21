import { NextResponse } from "next/server";
import { handler, parseBody } from "@/lib/api";
import { requireRole } from "@/lib/auth/guard";
import { auditContext } from "@/server/services/audit.service";
import { createInvoice } from "@/server/services/billing.service";
import { billConsultationSchema } from "@/server/validators/labs";
export const dynamic = "force-dynamic";

/** Bill a walk-in OP consultation. Reception / lab / admin. */
export const POST = handler(async (req) => {
  const actor = await requireRole(req, "RECEPTIONIST", "LAB_TECH", "ADMIN");
  const i = await parseBody(req, billConsultationSchema);
  const invoice = await createInvoice(
    actor,
    {
      patientId: i.patientId,
      source: "CONSULTATION",
      appointmentId: i.appointmentId,
      lines: [{ description: i.description, qty: 1, unitPrice: i.amount, gstRatePct: i.gstRatePct }],
      discountAmount: i.discountAmount,
      payment: i.payment,
      payments: i.payments,
    },
    auditContext(req)
  );
  return NextResponse.json({ invoice }, { status: 201 });
});
