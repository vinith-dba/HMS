import type { NextRequest } from "next/server";
import { ApiError } from "@/lib/api";
import { verifyAccessToken } from "@/lib/auth/jwt";
import { readAccessToken } from "@/lib/auth/session";
import type { AuthUser, Role } from "@/lib/auth/types";

/** Verifies the access token (cookie or Bearer) and returns the caller. */
export async function requireAuth(req: NextRequest): Promise<AuthUser> {
  const token = readAccessToken(req);
  if (!token) throw new ApiError(401, "Not authenticated");
  try {
    const payload = await verifyAccessToken(token);
    return { id: payload.sub, role: payload.role };
  } catch {
    throw new ApiError(401, "Invalid or expired session");
  }
}

/**
 * Role gate for route handlers:
 *   const user = await requireRole(req, "RECEPTIONIST", "ADMIN");
 */
export async function requireRole(req: NextRequest, ...roles: Role[]): Promise<AuthUser> {
  const user = await requireAuth(req);
  if (!roles.includes(user.role)) {
    throw new ApiError(403, "Insufficient permissions for this action");
  }
  return user;
}
