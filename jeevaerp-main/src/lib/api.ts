import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type RouteContext = { params: Promise<Record<string, string>> };
type RouteHandler = (req: NextRequest, ctx: RouteContext) => Promise<NextResponse>;

/**
 * Wraps every route handler: one place for error mapping.
 *  - ApiError          -> its own status
 *  - ZodError          -> 400 with field errors
 *  - Prisma P2002/P2025 (duck-typed; generated classes not imported) -> 409/404
 *  - anything else     -> 500, logged server-side, generic body
 */
export function handler(fn: RouteHandler): RouteHandler {
  return async (req, ctx) => {
    try {
      return await fn(req, ctx);
    } catch (err) {
      if (err instanceof ApiError) {
        return NextResponse.json(
          { error: err.message, ...(err.details !== undefined ? { details: err.details } : {}) },
          { status: err.status }
        );
      }
      if (err instanceof ZodError) {
        return NextResponse.json(
          { error: "Validation failed", details: err.flatten().fieldErrors },
          { status: 400 }
        );
      }
      const code = (err as { code?: string })?.code;
      if (code === "P2002") {
        return NextResponse.json({ error: "A record with these details already exists" }, { status: 409 });
      }
      if (code === "P2025") {
        return NextResponse.json({ error: "Record not found" }, { status: 404 });
      }
      console.error("[api] unhandled error:", err);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
  };
}

export async function parseBody<T>(req: NextRequest, schema: { parse: (v: unknown) => T }): Promise<T> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new ApiError(400, "Request body must be valid JSON");
  }
  return schema.parse(raw);
}
