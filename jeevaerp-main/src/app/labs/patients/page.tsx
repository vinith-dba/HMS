"use client";

import { useState } from "react";
import { PrimaryButton, Pill, statusTone } from "@/components/portal/ui/primitives";
import { Icon } from "@/components/portal/ui/icons";
import { Spinner } from "@/components/portal/ui/form-atoms";
import { PortalScroll } from "@/components/portal/portal-scroll";
import { api, ApiClientError } from "@/lib/api-client";

interface Bundle {
  patient: { id: string; displayId: string; fullName: string; phone: string; age: number | null; gender: string | null; bloodGroup: string | null };
  lastVisit: { opNumber: string; visitDate: string; doctorName: string; department: string; status: string } | null;
  tests: { id: string; testName: string; status: string; price: string | null; reportFileUrl: string | null; createdAt: string; billed: boolean }[];
  invoices: { receiptNo: string; totalAmount: string; status: string; createdAt: string }[];
}

export default function LabPatientsPage() {
  const [uhid, setUhid] = useState("");
  const [data, setData] = useState<Bundle | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function lookup() {
    if (!uhid.trim()) return;
    setError(null); setLoading(true); setData(null);
    try { setData(await api.get<Bundle>(`/labs/patients/${uhid.trim().toUpperCase()}`)); }
    catch (e) { setError(e instanceof ApiClientError ? e.message : "Patient not found."); }
    finally { setLoading(false); }
  }

  const fld = "w-full rounded-lg border border-[var(--p-border)] bg-white px-3.5 py-2.5 font-mono text-sm text-[var(--p-ink)] outline-none focus:border-[var(--p-teal)]";

  return (
    <PortalScroll>
      <div data-rise className="surface dotgrid mb-6 px-6 py-5">
        <h1 className="font-serif-p text-[22px] font-semibold text-[var(--p-ink)]">Patient history</h1>
        <p className="mt-1 text-[13px] text-[var(--p-muted)]">Last visit, all lab tests, reports and invoices — by Jeeva ID.</p>
        <div className="mt-4 flex max-w-md gap-2">
          <input value={uhid} onChange={(e) => setUhid(e.target.value.toUpperCase())} onKeyDown={(e) => e.key === "Enter" && lookup()} placeholder="JMH2026OP00001" className={fld} />
          <PrimaryButton onClick={lookup} disabled={loading}>{loading ? <Spinner /> : <Icon name="search" size={15} />} Find</PrimaryButton>
        </div>
        {error && <p className="mt-3 text-[13px] text-[var(--p-rose)]">{error}</p>}
      </div>

      {data && (
        <div className="space-y-6">
          {/* patient + last visit */}
          <div className="grid gap-6 lg:grid-cols-2">
            <section data-rise className="surface overflow-hidden">
              <div className="border-b border-[var(--p-border)] px-6 py-4"><h3 className="text-[13px] font-semibold text-[var(--p-ink)]">Patient</h3></div>
              <div className="grid grid-cols-2 gap-px bg-[var(--p-border)]">
                <Cell k="Name" v={data.patient.fullName} />
                <Cell k="Jeeva ID" v={data.patient.displayId} mono />
                <Cell k="Phone" v={data.patient.phone} mono />
                <Cell k="Age / Sex" v={`${data.patient.age ?? "—"} / ${data.patient.gender?.[0] ?? "—"}`} />
                <Cell k="Blood group" v={data.patient.bloodGroup ?? "—"} />
                <Cell k="Tests done" v={String(data.tests.length)} />
              </div>
            </section>

            <section data-rise className="surface overflow-hidden">
              <div className="border-b border-[var(--p-border)] px-6 py-4"><h3 className="text-[13px] font-semibold text-[var(--p-ink)]">Last visit</h3></div>
              {data.lastVisit ? (
                <div className="grid grid-cols-2 gap-px bg-[var(--p-border)]">
                  <Cell k="Doctor" v={data.lastVisit.doctorName} />
                  <Cell k="Department" v={data.lastVisit.department} />
                  <Cell k="Date" v={data.lastVisit.visitDate} mono />
                  <Cell k="OP number" v={data.lastVisit.opNumber} mono />
                </div>
              ) : (
                <p className="px-6 py-10 text-center text-[13px] text-[var(--p-muted)]">No visits recorded.</p>
              )}
            </section>
          </div>

          {/* tests */}
          <section data-rise className="surface overflow-hidden">
            <div className="flex items-center justify-between border-b border-[var(--p-border)] px-6 py-4">
              <h3 className="text-[13px] font-semibold text-[var(--p-ink)]">Lab tests</h3>
              <span className="badge">{data.tests.length}</span>
            </div>
            {data.tests.length === 0 ? (
              <p className="px-6 py-10 text-center text-[13px] text-[var(--p-muted)]">No lab tests for this patient.</p>
            ) : (
              <div className="divide-y divide-[var(--p-border)]">
                {data.tests.map((t) => (
                  <div key={t.id} className="flex items-center justify-between gap-3 px-6 py-3.5">
                    <div>
                      <div className="text-[13px] font-medium text-[var(--p-ink)]">{t.testName}</div>
                      <div className="text-[11px] text-[var(--p-muted)]">{new Date(t.createdAt).toLocaleDateString("en-IN")}{t.billed ? " · billed" : " · unbilled"}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      {t.price && <span className="font-mono text-[12px] text-[var(--p-muted)]">₹{t.price}</span>}
                      <Pill tone={statusTone(t.status === "PENDING" ? "Waiting" : "Completed")}>{t.status === "PENDING" ? "Pending" : "Completed"}</Pill>
                      {t.reportFileUrl && (
                        <a href={t.reportFileUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-lg border border-[var(--p-border)] px-2.5 py-1 text-[11px] font-medium text-[var(--p-teal)] hover:border-[var(--p-teal)]">
                          <Icon name="file" size={12} /> Report
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* invoices */}
          <section data-rise className="surface overflow-hidden">
            <div className="flex items-center justify-between border-b border-[var(--p-border)] px-6 py-4">
              <h3 className="text-[13px] font-semibold text-[var(--p-ink)]">Lab invoices</h3>
              <span className="badge">{data.invoices.length}</span>
            </div>
            {data.invoices.length === 0 ? (
              <p className="px-6 py-10 text-center text-[13px] text-[var(--p-muted)]">No lab invoices yet.</p>
            ) : (
              <div className="divide-y divide-[var(--p-border)]">
                {data.invoices.map((i) => (
                  <div key={i.receiptNo} className="flex items-center justify-between px-6 py-3.5">
                    <div>
                      <div className="font-mono text-[13px] font-medium text-[var(--p-ink)]">{i.receiptNo}</div>
                      <div className="text-[11px] text-[var(--p-muted)]">{new Date(i.createdAt).toLocaleDateString("en-IN")}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-[13px] font-semibold text-[var(--p-ink)]">₹{i.totalAmount}</span>
                      <Pill tone={statusTone(i.status === "PAID" ? "Completed" : "Waiting")}>{i.status}</Pill>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </PortalScroll>
  );
}

function Cell({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="bg-white px-6 py-3.5">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--p-muted)]">{k}</p>
      <p className={`mt-0.5 text-[13px] text-[var(--p-ink)] ${mono ? "font-mono text-[12px]" : ""}`}>{v}</p>
    </div>
  );
}
