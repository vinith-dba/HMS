"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/portal/ui/icons";
import { api } from "@/lib/api-client";

/**
 * THE IP/OP SWITCH
 *
 * The rule the whole hospital runs on, and the one nobody at the desk should have
 * to remember:
 *
 *   An admitted patient's reports, prescriptions and tests belong to their STAY.
 *   Everything files against the admission, and the money goes on the room tab —
 *   settled once, at discharge. Nobody chases a family to three counters.
 *
 *   An outpatient's belong to their VISIT, and they pay before they leave.
 *
 * Reception should never have to know which is which. So the moment a patient is
 * picked, the software asks the bed board, and says so — loudly, in colour, with
 * the ward and bed on it. The receptionist reads it; they don't decide it.
 */

export interface Admission {
  id: string;
  ipNumber: string;
  admittedAt: string;
  wardName: string;
  bedNo: string;
  doctorName: string;
  reason: string | null;
}

/** Ask the bed board. Returns null for an outpatient (the common case). */
export function useAdmission(patientId: string | null | undefined) {
  const [admission, setAdmission] = useState<Admission | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (!patientId) { setAdmission(null); return; }
    let alive = true;
    setChecking(true);
    api.get<{ admission: Admission | null }>(`/reception/patients/${patientId}/admission`)
      .then((r) => { if (alive) setAdmission(r.admission); })
      .catch(() => { if (alive) setAdmission(null); })
      .finally(() => { if (alive) setChecking(false); });
    return () => { alive = false; };
  }, [patientId]);

  return { admission, checking };
}

const days = (iso: string) =>
  Math.max(1, Math.ceil((Date.now() - new Date(iso).getTime()) / 86400000));

/**
 * @param what  what's being filed — "This prescription", "These tests"
 */
export function AdmissionBanner({
  admission,
  checking,
  what,
}: {
  admission: Admission | null;
  checking: boolean;
  what: string;
}) {
  if (checking) {
    return (
      <div className="mb-4 flex items-center gap-2 rounded-xl border border-[var(--p-border)] bg-[var(--p-bg)] px-4 py-3 text-[13px] text-[var(--p-muted)]">
        <span className="h-3 w-3 animate-pulse rounded-full bg-[var(--p-border-strong)]" />
        Checking whether they&apos;re admitted…
      </div>
    );
  }

  // ── OUTPATIENT — the quiet, common case. Say it once, calmly. ──
  if (!admission) {
    return (
      <div className="mb-4 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border border-[var(--p-border)] bg-[var(--p-surface)] px-4 py-3">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--p-bg)] px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-[var(--p-muted)]">
          <Icon name="users" size={12} /> Outpatient
        </span>
        <span className="text-[13px] text-[var(--p-text)]">
          {what} files against their <b>visit</b>. They pay at the counter before they leave.
        </span>
      </div>
    );
  }

  // ── INPATIENT — loud, unmissable, and it tells the desk what NOT to do. ──
  return (
    <div className="ip-banner mb-4 overflow-hidden rounded-xl">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white/25 text-white">
            <Icon name="bed" size={18} />
          </span>
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-x-2 text-[14px] font-bold text-white">
              Admitted — inpatient
              <span className="rounded bg-white/25 px-1.5 py-0.5 font-mono text-[11px] font-semibold">
                {admission.ipNumber}
              </span>
            </p>
            <p className="mt-0.5 truncate text-[12px] text-white/85">
              {admission.wardName} · <b>{admission.bedNo}</b> · Dr. {admission.doctorName} · day {days(admission.admittedAt)}
              {admission.reason && <> · {admission.reason}</>}
            </p>
          </div>
        </div>
        <Link href={`/ipd/${admission.id}`}
          className="shrink-0 rounded-lg bg-white/20 px-3 py-1.5 text-[12px] font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white/30">
          Open sheet →
        </Link>
      </div>

      <div className="bg-white/95 px-4 py-2.5">
        <p className="text-[12.5px] leading-relaxed text-[var(--p-ink)]">
          <b>{what} goes on the room tab</b> — filed against this stay, not a visit.
          Charges settle once, in the discharge bill. <b className="text-[var(--p-rose)]">Do not take money at the counter.</b>
        </p>
      </div>

      <style>{`
        .ip-banner {
          background: linear-gradient(135deg, var(--p-blue) 0%, var(--p-blue-deep) 100%);
          box-shadow: 0 8px 24px -12px var(--p-blue-glow);
        }
      `}</style>
    </div>
  );
}
