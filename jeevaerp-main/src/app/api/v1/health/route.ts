import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  let db: "up" | "down" = "up";
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    db = "down";
  }
  return NextResponse.json(
    {
      status: db === "up" ? "ok" : "degraded",
      service: "jeeva-erp-api",
      db,
      time: new Date().toISOString(),
    },
    { status: db === "up" ? 200 : 503 }
  );
}
