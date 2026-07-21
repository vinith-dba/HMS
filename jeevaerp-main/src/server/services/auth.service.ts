import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api";
import {
  generateOtp,
  hashOtp,
  verifyOtp,
  maskPhone,
  OTP_TTL_MS,
  OTP_MAX_ATTEMPTS,
  OTP_RATE_WINDOW_MS,
  OTP_RATE_MAX,
} from "@/lib/auth/otp";
import { verifyPassword, burnPasswordCheck } from "@/lib/auth/password";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "@/lib/auth/jwt";
import { sendOtpSms } from "@/lib/sms";
import { sendOtpEmail, maskEmail } from "@/lib/email";
import type { AuthUser, Role } from "@/lib/auth/types";

/** Refresh tokens are opaque to the DB — we store only their SHA-256. */
const hashToken = (t: string) => createHash("sha256").update(t).digest("hex");

export interface AuthResult {
  tokens: { access: string; refresh: string };
  user: AuthUser & { name: string; displayId?: string };
}

// ---------------------------------------------------------------------------
// Patient OTP login
// ---------------------------------------------------------------------------

/**
 * Step 1 of patient login. Rate-limited per patient. To avoid leaking which
 * IDs exist, the response shape is identical whether or not the patient is
 * found — the caller always sees a masked-phone acknowledgement.
 */
export async function requestOtp(patientId: string): Promise<{ sentTo: string }> {
  const patient = await prisma.patient.findUnique({
    where: { displayId: patientId },
    select: { id: true, phone: true, mergedIntoId: true },
  });

  // Unknown ID (or a merged-away record): return a plausible masked target,
  // do no work. Enumeration-safe.
  if (!patient || patient.mergedIntoId) {
    return { sentTo: "•••••• ••••" };
  }

  const since = new Date(Date.now() - OTP_RATE_WINDOW_MS);
  const recent = await prisma.otp.count({
    where: { patientId: patient.id, createdAt: { gte: since } },
  });
  if (recent >= OTP_RATE_MAX) {
    throw new ApiError(429, "Too many OTP requests. Please wait a few minutes and try again.");
  }

  const code = generateOtp();
  await prisma.otp.create({
    data: {
      patientId: patient.id,
      phone: patient.phone,
      codeHash: hashOtp(code),
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
    },
  });

  // Dev: logs to server console. Prod: throws until a provider is wired.
  await sendOtpSms(patient.phone, code);

  return { sentTo: maskPhone(patient.phone) };
}

/**
 * Step 2 of patient login. Consumes the newest unexpired OTP for the patient.
 * Attempts are capped per-OTP to defeat brute force; a correct code issues a
 * fresh session.
 */
export async function verifyOtpAndLogin(patientId: string, code: string): Promise<AuthResult> {
  const patient = await prisma.patient.findUnique({
    where: { displayId: patientId },
    select: { id: true, fullName: true, displayId: true, mergedIntoId: true },
  });
  if (!patient || patient.mergedIntoId) {
    throw new ApiError(400, "Invalid ID or code");
  }

  const otp = await prisma.otp.findFirst({
    where: { patientId: patient.id, consumedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  if (!otp) {
    throw new ApiError(400, "This code has expired. Request a new one.");
  }
  if (otp.attempts >= OTP_MAX_ATTEMPTS) {
    throw new ApiError(429, "Too many incorrect attempts. Request a new code.");
  }

  if (!verifyOtp(code, otp.codeHash)) {
    await prisma.otp.update({
      where: { id: otp.id },
      data: { attempts: { increment: 1 } },
    });
    throw new ApiError(400, "Incorrect code. Please try again.");
  }

  // Correct — consume this OTP and burn any other outstanding ones.
  await prisma.otp.updateMany({
    where: { patientId: patient.id, consumedAt: null },
    data: { consumedAt: new Date() },
  });

  const user: AuthUser = { id: patient.id, role: "PATIENT" };
  const tokens = await issueSession(user);
  return { tokens, user: { ...user, name: patient.fullName, displayId: patient.displayId } };
}

// ---------------------------------------------------------------------------
// Staff password login
// ---------------------------------------------------------------------------

export async function staffLogin(username: string, password: string): Promise<AuthResult> {
  const staff = await prisma.user.findUnique({
    where: { username },
    select: { id: true, name: true, role: true, passwordHash: true, isActive: true },
  });

  // Constant-time-ish: always run one bcrypt compare, even on unknown email,
  // so timing can't distinguish "no such user" from "wrong password".
  if (!staff || !staff.passwordHash) {
    await burnPasswordCheck(password);
    throw new ApiError(401, "Invalid email or password");
  }

  const ok = await verifyPassword(password, staff.passwordHash);
  if (!ok) throw new ApiError(401, "Invalid email or password");
  if (!staff.isActive) throw new ApiError(403, "This account has been deactivated");
  if (staff.role === "PATIENT") throw new ApiError(403, "Use the patient portal to sign in");

  await prisma.user.update({
    where: { id: staff.id },
    data: { lastLoginAt: new Date() },
  });

  const user: AuthUser = { id: staff.id, role: staff.role as Role };
  const tokens = await issueSession(user);
  return { tokens, user: { ...user, name: staff.name } };
}

// ---------------------------------------------------------------------------
// Sessions: issue, rotate (with reuse detection), revoke
// ---------------------------------------------------------------------------

const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;

async function issueSession(user: AuthUser): Promise<{ access: string; refresh: string }> {
  const access = await signAccessToken(user);
  const refresh = await signRefreshToken(user);
  await prisma.refreshToken.create({
    data: {
      tokenHash: hashToken(refresh),
      expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
      ...(user.role === "PATIENT" ? { patientId: user.id } : { userId: user.id }),
    },
  });
  return { access, refresh };
}

/**
 * Rotation with reuse detection. The presented refresh token must exist and
 * be unrevoked. On success we revoke it and mint a new pair. If a *revoked*
 * token is presented, that's a replay of a stolen token — we nuke every
 * session for that subject and force re-login.
 */
export async function rotateRefresh(presented: string): Promise<{ access: string; refresh: string }> {
  let payload: Awaited<ReturnType<typeof verifyRefreshToken>>;
  try {
    payload = await verifyRefreshToken(presented);
  } catch {
    throw new ApiError(401, "Invalid session. Please sign in again.");
  }

  const stored = await prisma.refreshToken.findUnique({
    where: { tokenHash: hashToken(presented) },
  });

  if (!stored) {
    throw new ApiError(401, "Session not recognised. Please sign in again.");
  }

  // Reuse of an already-revoked token → treat as compromise.
  if (stored.revokedAt) {
    await revokeAllForSubject({ id: payload.sub, role: payload.role });
    throw new ApiError(401, "Session reuse detected. All sessions have been signed out.");
  }

  if (stored.expiresAt < new Date()) {
    throw new ApiError(401, "Session expired. Please sign in again.");
  }

  const user: AuthUser = { id: payload.sub, role: payload.role };

  // Rotate: revoke old, issue new — inside one transaction.
  const access = await signAccessToken(user);
  const refresh = await signRefreshToken(user);
  await prisma.$transaction([
    prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    }),
    prisma.refreshToken.create({
      data: {
        tokenHash: hashToken(refresh),
        expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
        ...(user.role === "PATIENT" ? { patientId: user.id } : { userId: user.id }),
      },
    }),
  ]);

  return { access, refresh };
}

/** Logout: revoke just the presented session (best-effort, idempotent). */
export async function revokeRefresh(presented: string | null): Promise<void> {
  if (!presented) return;
  await prisma.refreshToken.updateMany({
    where: { tokenHash: hashToken(presented), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

// ---------------------------------------------------------------------------
// Staff sign-in sessions — "who was on the desk, and for how long".
// ---------------------------------------------------------------------------

/** Open a session row when a staff member signs in. */
export async function recordStaffLogin(
  userId: string,
  method: "OTP" | "PASSWORD",
  ctx: { ipAddress?: string; userAgent?: string }
): Promise<void> {
  await prisma.staffSession.create({
    data: { userId, method, ipAddress: ctx.ipAddress ?? null, userAgent: ctx.userAgent ?? null },
  });
}

/** Close the most recent open session for a user on sign-out. */
export async function recordStaffLogout(userId: string): Promise<void> {
  const open = await prisma.staffSession.findFirst({
    where: { userId, logoutAt: null },
    orderBy: { loginAt: "desc" },
    select: { id: true },
  });
  if (open) await prisma.staffSession.update({ where: { id: open.id }, data: { logoutAt: new Date() } });
}

/** Logout carries only the refresh cookie — resolve the user from it (valid even
 *  after the access token has expired) and close their open session. */
export async function recordStaffLogoutByRefresh(presented: string | null): Promise<void> {
  if (!presented) return;
  try {
    const payload = await verifyRefreshToken(presented);
    if (payload.typ === "refresh" && typeof payload.sub === "string" && payload.role !== "PATIENT") {
      await recordStaffLogout(payload.sub);
    }
  } catch { /* invalid/expired refresh — nothing to close */ }
}

export interface StaffSessionDTO {
  id: string; name: string; role: string; method: string;
  ipAddress: string | null; loginAt: string; logoutAt: string | null; durationMin: number | null;
}

/** Recent sign-in sessions for the admin activity view. */
export async function listStaffSessions(limit = 100): Promise<StaffSessionDTO[]> {
  const rows = await prisma.staffSession.findMany({
    orderBy: { loginAt: "desc" }, take: limit,
    select: { id: true, method: true, ipAddress: true, loginAt: true, logoutAt: true, user: { select: { name: true, role: true } } },
  });
  return rows.map((r) => ({
    id: r.id, name: r.user.name, role: r.user.role, method: r.method, ipAddress: r.ipAddress,
    loginAt: r.loginAt.toISOString(), logoutAt: r.logoutAt?.toISOString() ?? null,
    durationMin: r.logoutAt ? Math.max(0, Math.round((r.logoutAt.getTime() - r.loginAt.getTime()) / 60000)) : null,
  }));
}

async function revokeAllForSubject(user: AuthUser): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: {
      revokedAt: null,
      ...(user.role === "PATIENT" ? { patientId: user.id } : { userId: user.id }),
    },
    data: { revokedAt: new Date() },
  });
}

// ---------------------------------------------------------------------------
// Current identity (for GET /auth/me)
// ---------------------------------------------------------------------------

export async function getMe(user: AuthUser) {
  if (user.role === "PATIENT") {
    const p = await prisma.patient.findUnique({
      where: { id: user.id },
      select: { id: true, displayId: true, fullName: true, phone: true },
    });
    if (!p) throw new ApiError(404, "Patient not found");
    return {
      id: p.id,
      role: "PATIENT" as const,
      name: p.fullName,
      displayId: p.displayId,
      phone: maskPhone(p.phone),
    };
  }

  const u = await prisma.user.findUnique({
    where: { id: user.id },
    select: { id: true, name: true, email: true, role: true, isActive: true },
  });
  if (!u || !u.isActive) throw new ApiError(404, "Account not found");
  return { id: u.id, role: u.role, name: u.name, email: u.email };
}

// ---------------------------------------------------------------------------
// Staff OTP login (username = role.name; code sent to registered email)
// ---------------------------------------------------------------------------


/**
 * Step 1 of staff login. Looks up a staff member by username (role.name).
 * Enumeration-safe: the response shape is identical whether or not the user
 * exists, and a code is only actually sent if they're a real, active staff
 * account WITH an email on file.
 */
export async function requestStaffOtp(username: string): Promise<{ sentTo: string }> {
  const staff = await prisma.user.findUnique({
    where: { username },
    select: { id: true, email: true, isActive: true, role: true },
  });

  // Unknown / inactive / patient / no-email → plausible masked response, no work.
  if (!staff || !staff.isActive || staff.role === "PATIENT" || !staff.email) {
    return { sentTo: "your registered email" };
  }

  const since = new Date(Date.now() - OTP_RATE_WINDOW_MS);
  const recent = await prisma.otp.count({
    where: { userId: staff.id, createdAt: { gte: since } },
  });
  if (recent >= OTP_RATE_MAX) {
    throw new ApiError(429, "Too many code requests. Please wait a few minutes.");
  }

  const code = generateOtp();
  await prisma.otp.create({
    data: {
      userId: staff.id,
      destination: maskEmail(staff.email),
      codeHash: hashOtp(code),
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
    },
  });
  await sendOtpEmail(staff.email, code);
  return { sentTo: maskEmail(staff.email) };
}

/**
 * Step 2 of staff login. Verifies the code and issues a staff session,
 * returning the role so the caller can redirect to the right portal.
 */
export async function verifyStaffOtp(username: string, code: string): Promise<AuthResult> {
  const staff = await prisma.user.findUnique({
    where: { username },
    select: { id: true, name: true, role: true, isActive: true },
  });
  if (!staff || !staff.isActive || staff.role === "PATIENT") {
    throw new ApiError(400, "Invalid username or code");
  }

  const otp = await prisma.otp.findFirst({
    where: { userId: staff.id, consumedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  if (!otp) throw new ApiError(400, "This code has expired. Request a new one.");
  if (otp.attempts >= OTP_MAX_ATTEMPTS) throw new ApiError(429, "Too many incorrect attempts. Request a new code.");

  if (!verifyOtp(code, otp.codeHash)) {
    await prisma.otp.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } });
    throw new ApiError(400, "Incorrect code. Please try again.");
  }

  await prisma.otp.updateMany({ where: { userId: staff.id, consumedAt: null }, data: { consumedAt: new Date() } });
  await prisma.user.update({ where: { id: staff.id }, data: { lastLoginAt: new Date() } });

  const authUser: AuthUser = { id: staff.id, role: staff.role as Role };
  const tokens = await issueSession(authUser);
  return { tokens, user: { ...authUser, name: staff.name } };
}
