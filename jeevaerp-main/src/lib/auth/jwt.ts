import { SignJWT, jwtVerify } from "jose";
import { env } from "@/lib/env";
import type { Role } from "@/lib/auth/types";

export interface TokenPayload {
  /** User.id for staff, Patient.id for patients */
  sub: string;
  role: Role;
  typ: "access" | "refresh";
}

const encode = (secret: string) => new TextEncoder().encode(secret);

async function sign(payload: TokenPayload, secret: string, ttl: string): Promise<string> {
  return new SignJWT({ role: payload.role, typ: payload.typ })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(ttl)
    .sign(encode(secret));
}

async function verify(token: string, secret: string, typ: "access" | "refresh"): Promise<TokenPayload> {
  const { payload } = await jwtVerify(token, encode(secret));
  if (payload.typ !== typ || typeof payload.sub !== "string" || typeof payload.role !== "string") {
    throw new Error("Malformed token");
  }
  return { sub: payload.sub, role: payload.role as Role, typ };
}

export const signAccessToken = (u: { id: string; role: Role }) =>
  sign({ sub: u.id, role: u.role, typ: "access" }, env().JWT_ACCESS_SECRET, env().ACCESS_TOKEN_TTL);

export const signRefreshToken = (u: { id: string; role: Role }) =>
  sign({ sub: u.id, role: u.role, typ: "refresh" }, env().JWT_REFRESH_SECRET, env().REFRESH_TOKEN_TTL);

export const verifyAccessToken = (t: string) => verify(t, env().JWT_ACCESS_SECRET, "access");
export const verifyRefreshToken = (t: string) => verify(t, env().JWT_REFRESH_SECRET, "refresh");
