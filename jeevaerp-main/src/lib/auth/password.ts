import bcrypt from "bcryptjs";

const COST = 12;

export const hashPassword = (plain: string) => bcrypt.hash(plain, COST);

export const verifyPassword = (plain: string, hash: string) => bcrypt.compare(plain, hash);

/**
 * Burned on every failed staff lookup so "unknown email" and "wrong password"
 * take the same time — no account enumeration via response timing.
 * This is a real bcrypt digest of a throwaway string; it never matches anything.
 */
const DUMMY_HASH = "$2b$12$IN7geE9Tnxo2rp8HT.1pe.LAj3N3q/whYSg8mZ1O/QuLSh9e2U9Ge";
export const burnPasswordCheck = (plain: string) => bcrypt.compare(plain, DUMMY_HASH);
