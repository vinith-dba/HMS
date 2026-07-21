"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PrimaryButton, Pill, statusTone } from "@/components/portal/ui/primitives";
import { Icon } from "@/components/portal/ui/icons";
import { Spinner } from "@/components/portal/ui/form-atoms";
import { PortalScroll } from "@/components/portal/portal-scroll";
import { api, ApiClientError } from "@/lib/api-client";

interface Chart {
  patient: { displayId: string; fullName: string; age: number | null; gender: string | null; bloodGroup: string | null; phone: string; address: string | null; occupation: string | null; remarks: string | null; isVip: boolean };
  visits: { opNumber: string; visitDate: string; status: string; doctorName: string; department: string }[];
  labs: { id: string; testName: string; status: string; reportFileUrl: string | null; createdAt: string; completedAt: string | null }[];
  prescriptions: { id: string; fileUrl: string; title: string | null; doctorName: string | null; status: string; createdAt: string; visitDate: string | null }[];
}

function ChartInner() {
  const params = useSearchParams();
  const preset = params.get("id") ?? "";
  const [uhid, setUhid] = useState(preset);
  const [c, setC] = useState<Chart | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lookup = useCallback(async (id: string) => {
    if (!id.trim()) return;
    setLoading(true); setError(null); setC(null);
    try { setC(await api.get<Chart>(`/doctor/patients/${id.trim().toUpperCase()}`)); }
    catch (e) { setError(e instanceof ApiClientError ? e.message : "Patient not found."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { if (preset) lookup(preset); }, [preset, lookup]);

  const fld = "w-full rounded-lg border border-[var(--p-border)] bg-white px-3.5 py-2.5 font-mono text-sm text-[var(--p-ink)] outline-none focus:border-[var(--p-blue)]";

  return (
    <PortalScroll>
      <div data-rise className="surface dotgrid mb-6 px-6 py-5">
        <h1 className="font-serif-p text-[22px] font-semibold text-[var(--p-ink)]">Patient chart</h1>
        <p className="mt-1 text-[13px] text-[var(--p-muted)]">History, lab results, and scans of the prescriptions you wrote.</p>
        <div className="mt-4 flex max-w-md gap-2">
          <input value={uhid} onChange={(e) => setUhid(e.target.value.toUpperCase())} onKeyDown={(e) => e.key === "Enter" && lookup(uhid)} placeholder="JMH2026OP00001" className={fld} />
          <PrimaryButton onClick={() => lookup(uhid)} disabled={loading}>{loading ? <Spinner /> : <Icon name="search" size={15} />} Open</PrimaryButton>
        </div>
        {error && <p className="mt-3 text-[13px] text-[var(--p-rose)]">{error}</p>}
      </div>

      {c && (
        <div className="space-y-6">
          <section data-rise className="surface overflow-hidden">
            <div className="flex items-center justify-between border-b border-[var(--p-border)] px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-[var(--p-blue)] to-[var(--p-cyan)] font-serif-p text-[13px] font-semibold text-white">
                  {c.patient.fullName.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-[16px] font-semibold text-[var(--p-ink)]">{c.patient.fullName}</h3>
                    {c.patient.isVip && <span className="badge !text-[10px]">VIP</span>}
                  </div>
                  <p className="font-mono text-[12px] text-[var(--p-blue)]">{c.patient.displayId}</p>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-px bg-[var(--p-border)] sm:grid-cols-4">
              <F k="Age / Sex" v={`${c.patient.age ?? "—"} / ${c.patient.gender?.[0] ?? "—"}`} />
              <F k="Blood group" v={c.patient.bloodGroup ?? "—"} />
              <F k="Phone" v={c.patient.phone} />
              <F k="Occupation" v={c.patient.occupation ?? "—"} />
            </div>
            {c.patient.remarks && (
              <p className="border-t border-[var(--p-border)] bg-[var(--p-amber-soft)] px-6 py-3 text-[12px] text-[#8a6414]">
                <strong>Note:</strong> {c.patient.remarks}
              </p>
            )}
          </section>

          {/* the handwritten prescriptions */}
          <section data-rise className="surface overflow-hidden">
            <div className="flex items-center justify-between border-b border-[var(--p-border)] px-6 py-4">
              <div>
                <h3 className="text-[14px] font-semibold text-[var(--p-ink)]">Prescriptions</h3>
                <p className="mt-0.5 text-[12px] text-[var(--p-muted)]">Scans of what was written by hand at each visit.</p>
              </div>
              <span className="badge">{c.prescriptions.length}</span>
            </div>
            {!c.prescriptions.length ? <p className="py-10 text-center text-[13px] text-[var(--p-muted)]">No prescriptions on file.</p> : (
              <div className="divide-y divide-[var(--p-border)]">
                {c.prescriptions.map((p) => (
                  <div key={p.id} className="flex items-center justify-between gap-3 px-6 py-3.5">
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--p-cyan-soft)] text-[var(--p-cyan-deep)]"><Icon name="file" size={16} /></span>
                      <div>
                        <div className="text-[13px] font-medium text-[var(--p-ink)]">{p.title || "Prescription"}</div>
                        <div className="text-[11px] text-[var(--p-muted)]">
                          <span className="font-mono">{p.visitDate ?? p.createdAt}</span>
                          {p.doctorName && ` · ${p.doctorName}`}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Pill tone={p.status === "DISPENSED" ? "completed" : p.status === "SENT_TO_PHARMACY" ? "waiting" : "neutral"}>
                        {p.status === "DISPENSED" ? "Dispensed" : p.status === "SENT_TO_PHARMACY" ? "At pharmacy" : "Scanned"}
                      </Pill>
                      <a href={p.fileUrl} target="_blank" rel="noopener noreferrer"
                        className="rounded-lg border border-[var(--p-border)] px-3 py-1.5 text-[12px] font-medium text-[var(--p-blue)] hover:border-[var(--p-blue)]">View</a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <div className="grid gap-6 lg:grid-cols-2">
            <section data-rise className="surface overflow-hidden">
              <div className="flex items-center justify-between border-b border-[var(--p-border)] px-6 py-4">
                <h3 className="text-[13px] font-semibold text-[var(--p-ink)]">Lab results</h3><span className="badge">{c.labs.length}</span>
              </div>
              {!c.labs.length ? <p className="py-10 text-center text-[13px] text-[var(--p-muted)]">No lab tests.</p> : (
                <div className="max-h-80 divide-y divide-[var(--p-border)] overflow-y-auto overscroll-contain">
                  {c.labs.map((l) => (
                    <div key={l.id} className="flex items-center justify-between px-6 py-3">
                      <div>
                        <div className="text-[13px] font-medium text-[var(--p-ink)]">{l.testName}</div>
                        <div className="text-[11px] text-[var(--p-muted)]"><span className="font-mono">{l.completedAt ?? l.createdAt}</span></div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Pill tone={l.status === "COMPLETED" ? "completed" : "waiting"}>{l.status === "COMPLETED" ? "Ready" : "Pending"}</Pill>
                        {l.reportFileUrl && (
                          <a href={l.reportFileUrl} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-[var(--p-border)] px-2.5 py-1 text-[11px] font-medium text-[var(--p-blue)] hover:border-[var(--p-blue)]">Report</a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section data-rise className="surface overflow-hidden">
              <div className="flex items-center justify-between border-b border-[var(--p-border)] px-6 py-4">
                <h3 className="text-[13px] font-semibold text-[var(--p-ink)]">Visit history</h3><span className="badge">{c.visits.length}</span>
              </div>
              {!c.visits.length ? <p className="py-10 text-center text-[13px] text-[var(--p-muted)]">No visits.</p> : (
                <div className="max-h-80 divide-y divide-[var(--p-border)] overflow-y-auto overscroll-contain">
                  {c.visits.map((v) => (
                    <div key={v.opNumber} className="flex items-center justify-between px-6 py-3">
                      <div>
                        <div className="text-[13px] font-medium text-[var(--p-ink)]">{v.doctorName}</div>
                        <div className="text-[11px] text-[var(--p-muted)]">{v.department} · <span className="font-mono">{v.visitDate}</span></div>
                      </div>
                      <Pill tone={statusTone(v.status === "COMPLETED" ? "Completed" : "Waiting")}>{v.status === "COMPLETED" ? "Done" : "Booked"}</Pill>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      )}
    </PortalScroll>
  );
}

function F({ k, v }: { k: string; v: string }) {
  return (
    <div className="bg-white px-6 py-3.5">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--p-muted)]">{k}</p>
      <p className="mt-0.5 text-[13px] text-[var(--p-ink)]">{v}</p>
    </div>
  );
}

export default function DoctorPatientsPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center gap-2 py-20 text-[13px] text-[var(--p-muted)]"><Spinner /> Loading…</div>}>
      <ChartInner />
    </Suspense>
  );
}
