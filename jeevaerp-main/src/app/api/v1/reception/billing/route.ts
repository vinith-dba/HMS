import { NextResponse } from "next/server";
import { handler } from "@/lib/api";
import { requireRole } from "@/lib/auth/guard";
import { listInvoices } from "@/server/services/billing.service";

export const dynamic = "force-dynamic";

/** Every bill the desk might need to settle, void or reprint. */
export const GET = handler(async (req) => {
  await requireRole(req, "RECEPTIONIST", "ADMIN");
  const source = req.nextUrl.searchParams.get("source") ?? undefined;
  const invoices = await listInvoices(source as never, 100);
  return NextResponse.json({ invoices });
});
