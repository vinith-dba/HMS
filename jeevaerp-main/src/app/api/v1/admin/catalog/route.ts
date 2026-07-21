import { NextResponse } from "next/server";
import { handler, parseBody } from "@/lib/api";
import { requireRole } from "@/lib/auth/guard";
import { auditContext } from "@/server/services/audit.service";
import { listAllCatalog, upsertCatalogItem } from "@/server/services/admin.service";
import { catalogItemSchema } from "@/server/validators/admin";
export const dynamic = "force-dynamic";

export const GET = handler(async (req) => {
  await requireRole(req, "ADMIN");
  return NextResponse.json({ catalog: await listAllCatalog() });
});

/** Create or update a lab test — this is where GST rates are set. */
export const POST = handler(async (req) => {
  const actor = await requireRole(req, "ADMIN");
  const i = await parseBody(req, catalogItemSchema);
  await upsertCatalogItem(actor, { ...i, code: i.code || undefined }, auditContext(req));
  return NextResponse.json({ ok: true }, { status: 201 });
});
