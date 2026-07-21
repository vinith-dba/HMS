import { NextResponse } from "next/server";
import { handler } from "@/lib/api";
import { requireRole } from "@/lib/auth/guard";
import { listInvoices, type InvoiceSourceT } from "@/server/services/billing.service";
export const dynamic = "force-dynamic";
export const GET = handler(async (req) => {
  await requireRole(req, "RECEPTIONIST", "LAB_TECH", "PHARMACIST", "ADMIN");
  const { searchParams } = new URL(req.url);
  const s = searchParams.get("source");
  const valid = ["CONSULTATION", "LAB", "PHARMACY", "OTHER"];
  const source = s && valid.includes(s) ? (s as InvoiceSourceT) : undefined;
  return NextResponse.json({ invoices: await listInvoices(source) });
});
