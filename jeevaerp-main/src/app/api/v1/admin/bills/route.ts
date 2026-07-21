import { NextResponse } from "next/server";
import { handler } from "@/lib/api";
import { requireRole } from "@/lib/auth/guard";
import { listInvoices, type InvoiceSourceT } from "@/server/services/billing.service";

export const dynamic = "force-dynamic";

/** Every bill across all counters, with how it was paid — ADMIN ONLY. */
export const GET = handler(async (req) => {
  await requireRole(req, "ADMIN");
  const s = new URL(req.url).searchParams.get("source");
  const valid = ["CONSULTATION", "LAB", "PHARMACY", "IPD", "OTHER"];
  const source = s && valid.includes(s) ? (s as InvoiceSourceT) : undefined;
  return NextResponse.json({ invoices: await listInvoices(source, 200) });
});
