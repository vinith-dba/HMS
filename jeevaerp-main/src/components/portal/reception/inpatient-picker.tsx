"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/portal/ui/icons";
import { api } from "@/lib/api-client";

/**
 * PICK BY BED, NOT BY NAME.
 *
 * A receptionist doing outpatient work searches for a person: "Ramesh Kumar".
 * A receptionist doing INPATIENT work never does. The ward rings down and says
 * "ICU bed 3's reports are here" — the bed IS the identifier. Making them
 * remember and type a name they were never told is a small cruelty repeated
 * fifty times a day.
 *
 * So: every admitted patient, grouped by ward, tappable by bed. One tap loads the
 * patient AND their admission — no second lookup, no leaving the page.
 */

export interface Inpatient {
  id: string;                 // admission id
  ipNumber: string;
  ward: string;
  bedNo: string;
  days: number;
  reason: string | null;
  runningCharge: string;
  doctor: { name: string; department: string };
  patient: { id: string; displayId: string; fullName: string; age: number | null; gender: string | null; phone: string };
}

/** Little occupied-bed mark — same glyph language as the bed board. */
function BedMark() {
  return (
    <svg viewBox="0 0 76 46" className="w-9" aria-hidden>
      <rect x="5" y="9" width="5.5" height="29" rx="2.75" fill="currentColor" opacity=".45" />
      <rect x="64.5" y="22" width="5.5" height="16" rx="2.75" fill="currentColor" opacity=".45" />
      <rect x="9" y="25" width="56" height="11" rx="3.5" fill="#fff" stroke="currentColor" strokeOpacity=".4" strokeWidth="1.4" />
      <path d="M31 25h29a4.5 4.5 0 0 1 4.5 4.5v2A4.5 4.5 0 0 1 60 36H31z" fill="currentColor" opacity=".8" />
      <path d="M45 25.4c3.4-5.6 10-5.6 13.2 0z" fill="currentColor" opacity=".8" />
      <circle cx="22" cy="19" r="5.2" fill="currentColor" />
    </svg>
  );
}

export function InpatientPicker({
  onPick,
  pickedPatientId,
}: {
  onPick: (ip: Inpatient) => void;
  pickedPatientId?: string | null;
}) {
  const [rows, setRows] = useState<Inpatient[] | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    api.get<{ inpatients: Inpatient[] }>("/ipd/admissions")
      .then((r) => setRows(r.inpatients))
      .catch(() => setRows([]));
  }, []);

  // Nothing admitted — don't clutter the page with an empty accordion.
  if (rows !== null && rows.length === 0) return null;

  const wards = new Map<string, Inpatient[]>();
  for (const r of rows ?? []) {
    if (!wards.has(r.ward)) wards.set(r.ward, []);
    wards.get(r.ward)!.push(r);
  }

  return (
    <div className="mb-4 overflow-hidden rounded-xl border border-[var(--p-blue)]/25 bg-[var(--p-blue-soft)]">
      <button onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-[var(--p-blue)]/10">
        <span className="flex items-center gap-2.5">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-[var(--p-blue)] text-white">
            <Icon name="bed" size={14} />
          </span>
          <span>
            <span className="block text-[13.5px] font-semibold text-[var(--p-ink)]">
              Someone in a bed? Pick them here.
            </span>
            <span className="block text-[12px] text-[var(--p-muted)]">
              {rows === null
                ? "Loading the wards…"
                : `${rows.length} patient${rows.length === 1 ? "" : "s"} admitted right now — no need to search by name.`}
            </span>
          </span>
        </span>
        <span className={`text-[var(--p-blue)] transition-transform duration-200 ${open ? "rotate-90" : ""}`}>
          <Icon name="chevron" size={15} />
        </span>
      </button>

      {open && rows !== null && (
        <div className="space-y-4 border-t border-[var(--p-blue)]/20 bg-[var(--p-surface)] p-4">
          {[...wards.entries()].map(([ward, list]) => (
            <div key={ward}>
              <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--p-muted)]">{ward}</p>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {list.map((ip) => {
                  const on = pickedPatientId === ip.patient.id;
                  return (
                    <button key={ip.id} onClick={() => { onPick(ip); setOpen(false); }}
                      className={`flex items-center gap-3 rounded-xl border p-3 text-left transition-all ${
                        on
                          ? "border-[var(--p-blue)] bg-[var(--p-blue-soft)] shadow-[0_0_0_3px_var(--p-blue-glow)]"
                          : "border-[var(--p-border)] hover:-translate-y-0.5 hover:border-[var(--p-blue)] hover:shadow-[var(--p-shadow)]"
                      }`}>
                      <span className="shrink-0 text-[var(--p-blue)]"><BedMark /></span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5">
                          <span className="font-mono text-[12px] font-bold text-[var(--p-blue-deep)]">{ip.bedNo}</span>
                          {on && <Icon name="check" size={12} />}
                        </span>
                        <span className="block truncate text-[13.5px] font-semibold text-[var(--p-ink)]">
                          {ip.patient.fullName}
                        </span>
                        <span className="block truncate text-[11.5px] text-[var(--p-muted)]">
                          <span className="font-mono">{ip.ipNumber}</span> · day {ip.days} · Dr. {ip.doctor.name}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
