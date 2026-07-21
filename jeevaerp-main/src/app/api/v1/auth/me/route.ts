import { NextResponse } from "next/server";
import { handler } from "@/lib/api";
import { requireAuth } from "@/lib/auth/guard";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** The signed-in user, for greeting + showing the real name in the shell. */
export const GET = handler(async (req) => {
  const auth = await requireAuth(req);
  if (auth.role === "PATIENT") {
    const p = await prisma.patient.findUnique({ where: { id: auth.id }, select: { fullName: true, displayId: true } });
    return NextResponse.json({ name: p?.fullName ?? "Patient", role: auth.role, username: p?.displayId ?? null });
  }
  const u = await prisma.user.findUnique({ where: { id: auth.id }, select: { name: true, username: true, role: true } });
  return NextResponse.json({ name: u?.name ?? "there", role: u?.role ?? auth.role, username: u?.username ?? null });
});
