import { NextResponse } from "next/server";
import { handler } from "@/lib/api";
import { requireAuth } from "@/lib/auth/guard";
import { getMe } from "@/server/services/auth.service";
import { destinationFor } from "@/lib/auth/portals";
import { resolveOrigin } from "@/lib/auth/origin";

export const dynamic = "force-dynamic";

/**
 * Lightweight "who am I + where do I belong" check. The client can call this
 * on load to decide whether to stay or bounce to the correct portal.
 */
export const GET = handler(async (req) => {
  const caller = await requireAuth(req);
  const me = await getMe(caller);
  const redirectTo = destinationFor(caller.role, resolveOrigin(req));
  return NextResponse.json({ user: me, redirectTo });
});
