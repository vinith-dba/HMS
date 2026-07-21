import { prisma } from "./prisma";
import type { Prisma } from "@prisma/client";

/**
 * Human-facing ID formats, all year-scoped:
 *   PATIENT   -> JMH2026OP00123    (printed on OP slip; patient logs in with this)
 *   OP        -> OP-2026-000045    (per appointment)
 *   INVOICE   -> INV-2026-000312   (every invoice, any source — one sequence)
 *   IP        -> JMH2026IP00007    (per inpatient admission)
 */
const pad = (n: number) => String(n).padStart(6, "0");

const FORMATS = {
  PATIENT: (y: number, n: number) => `JMH${y}OP${String(n).padStart(5, "0")}`,
  OP: (y: number, n: number) => `OP-${y}-${pad(n)}`,
  INVOICE: (y: number, n: number) => `INV-${y}-${pad(n)}`,
  /** Inpatient admission — printed on the case sheet and wristband. */
  IP: (y: number, n: number) => `JMH${y}IP${String(n).padStart(5, "0")}`,
  /** Insurance claim — CLM-2026-000045. */
  CLAIM: (y: number, n: number) => `CLM-${y}-${pad(n)}`,
} as const;

export type IdKind = keyof typeof FORMATS;

/**
 * Race-safe sequential ID generation.
 *
 * The insert-or-increment happens in ONE SQL statement, so two receptionists
 * registering patients in the same millisecond can never receive the same
 * number — Postgres serializes the row update internally.
 *
 * Pass `tx` to enrol the counter bump in a surrounding transaction (so an ID
 * is never burned if the operation that needed it rolls back).
 */
export async function nextId(
  kind: IdKind,
  opts: { year?: number; tx?: Prisma.TransactionClient } = {}
): Promise<string> {
  const year = opts.year ?? new Date().getFullYear();
  const db = opts.tx ?? prisma;
  const key = `${kind}-${year}`;
  const rows = await db.$queryRaw<Array<{ value: number }>>`
    INSERT INTO "Counter" ("key", "value")
    VALUES (${key}, 1)
    ON CONFLICT ("key")
    DO UPDATE SET "value" = "Counter"."value" + 1
    RETURNING "value"
  `;
  return FORMATS[kind](year, rows[0].value);
}
