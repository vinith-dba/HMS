"use client";

import { useEffect, useRef, useState } from "react";
import { Pill, statusTone, PrimaryButton } from "@/components/portal/ui/primitives";
import { Icon } from "@/components/portal/ui/icons";
import { Spinner } from "@/components/portal/ui/form-atoms";
import { PortalScroll } from "@/components/portal/portal-scroll";
import { api, ApiClientError } from "@/lib/api-client";

interface Test {
  id: string; testName: string; status: string; price: string | null; reportFileUrl: string | null;
  createdAt: string; completedAt: string | null; billed: boolean;
  patient: { id: string; displayId: string; fullName: string; phone: string } | null;
  appointment: { opNumber: string; doctorName: string; visitDate: string } | null;
}

export default function LabQueuePage() {
  const [filter, setFilter] = useState<"PENDING" | "COMPLETED" | "ALL">("PENDING");
  const [tests, setTests] = useState<Test[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  async function load() {
    setLoading(true);
    try {
      const q = filter === "ALL" ? "" : `?status=${filter}`;
      const { tests } = await api.get<{ tests: Test[] }>(`/labs/tests${q}`);
      setTests(tests);
    } catch { setTests([]); } finally { setLoading(false); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [filter]);

  async function complete(id: string) {
    setError(null); setBusyId(id);
    try { await api.post("/labs/tests/complete", { labTestId: id }); await load(); }
    catch (e) { setError(e instanceof ApiClientError ? e.message : "Could not complete the test."); }
    finally { setBusyId(null); }
  }

  async function removeReport(id: string) {
    setError(null); setBusyId(id);
    try { await api.post("/labs/tests/report/remove", { labTestId: id }); await load(); }
    catch (e) { setError(e instanceof ApiClientError ? e.message : "Could not remove the report."); }
    finally { setBusyId(null); }
  }

  async function uploadReport(id: string, file: File) {
    setError(null); setBusyId(id);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("labTestId", id);
      const res = await fetch("/api/v1/labs/tests/report", { method: "POST", body: form, credentials: "same-origin" });
      const body = await res.json();
      if (!res.ok) throw new ApiClientError(res.status, body.error ?? "Upload failed");
      await load();
    } catch (e) { setError(e instanceof ApiClientError ? e.message : "Upload failed."); }
    finally { setBusyId(null); }
  }

  return (
    <PortalScroll>
      <div data-rise className="surface dotgrid mb-6 flex flex-wrap items-center justify-between gap-4 px-6 py-5">
        <div>
          <h1 className="font-serif-p text-[22px] font-semibold text-[var(--p-ink)]">Test queue</h1>
          <p className="mt-1 text-[13px] text-[var(--p-muted)]">Upload a report to complete a test, or mark it done.</p>
        </div>
        <div className="flex gap-1 rounded-full border border-[var(--p-border)] bg-white p-1">
          {(["PENDING", "COMPLETED", "ALL"] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition-colors ${filter === f ? "bg-[var(--p-teal)] text-white" : "text-[var(--p-muted)] hover:text-[var(--p-ink)]"}`}>
              {f === "ALL" ? "All" : f.charAt(0) + f.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div data-rise className="mb-4 flex items-start gap-2 rounded-lg border border-[var(--p-rose)]/25 bg-[var(--p-rose-soft)] px-4 py-3 text-[13px] text-[var(--p-rose)]">
          <Icon name="alert" size={15} /> <span>{error}</span>
        </div>
      )}

      <section data-rise className="surface overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-20 text-[13px] text-[var(--p-muted)]"><Spinner /> Loading tests…</div>
        ) : tests.length === 0 ? (
          <div className="dotgrid flex flex-col items-center py-20 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full border border-[var(--p-border)] bg-white text-[var(--p-muted)]"><Icon name="flask" size={20} /></span>
            <p className="mt-3 text-[13px] text-[var(--p-muted)]">No {filter === "ALL" ? "" : filter.toLowerCase()} tests.</p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--p-border)]">
            {tests.map((t) => (
              <div key={t.id} className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 transition-colors hover:bg-[var(--p-bg)]">
                <div className="min-w-[220px]">
                  <div className="flex items-center gap-2">
                    <span className="text-[14px] font-medium text-[var(--p-ink)]">{t.testName}</span>
                    {t.billed && <span className="badge !py-0.5 !text-[10px]">billed</span>}
                  </div>
                  <div className="mt-0.5 text-[12px] text-[var(--p-muted)]">
                    {t.patient?.fullName ?? "—"} · <span className="tabular">{t.patient?.displayId ?? "—"}</span>
                    {t.appointment ? ` · ${t.appointment.doctorName} (${t.appointment.opNumber})` : " · walk-in"}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {t.price && <span className="font-mono text-[12px] text-[var(--p-muted)]">₹{t.price}</span>}
                  <Pill tone={statusTone(t.status === "PENDING" ? "Waiting" : "Completed")}>
                    {t.status === "PENDING" ? "Pending" : "Completed"}
                  </Pill>

                  {t.reportFileUrl && (
                    <a href={t.reportFileUrl} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--p-border)] px-3 py-1.5 text-[12px] font-medium text-[var(--p-teal)] transition-colors hover:border-[var(--p-teal)]">
                      <Icon name="file" size={13} /> Report
                    </a>
                  )}

                  {t.status === "COMPLETED" && (
                    <>
                      <input
                        ref={(el) => { fileRefs.current[t.id] = el; }}
                        type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" className="hidden"
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadReport(t.id, f); }}
                      />
                      <button onClick={() => fileRefs.current[t.id]?.click()} disabled={busyId === t.id}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--p-border)] px-3 py-1.5 text-[12px] font-medium text-[var(--p-text)] transition-colors hover:border-[var(--p-teal)] hover:text-[var(--p-teal)] disabled:opacity-60">
                        {busyId === t.id ? <Spinner size={12} /> : <Icon name="file" size={13} />} Replace
                      </button>
                      {t.reportFileUrl && (
                        <button onClick={() => removeReport(t.id)} disabled={busyId === t.id}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--p-rose)]/30 px-3 py-1.5 text-[12px] font-medium text-[var(--p-rose)] transition-colors hover:bg-[var(--p-rose-soft)] disabled:opacity-60">
                          <Icon name="alert" size={13} /> Remove
                        </button>
                      )}
                    </>
                  )}

                  {t.status === "PENDING" && (
                    <>
                      <input
                        ref={(el) => { fileRefs.current[t.id] = el; }}
                        type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" className="hidden"
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadReport(t.id, f); }}
                      />
                      <button onClick={() => fileRefs.current[t.id]?.click()} disabled={busyId === t.id}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--p-teal)] px-3 py-1.5 text-[12px] font-semibold text-white transition-colors hover:bg-[var(--p-teal-deep)] disabled:opacity-60">
                        {busyId === t.id ? <Spinner size={12} /> : <Icon name="file" size={13} />} Upload report
                      </button>
                      <button onClick={() => complete(t.id)} disabled={busyId === t.id}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--p-border)] px-3 py-1.5 text-[12px] font-medium text-[var(--p-text)] transition-colors hover:border-[var(--p-teal)] hover:text-[var(--p-teal)] disabled:opacity-60">
                        <Icon name="check" size={13} /> Mark done
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </PortalScroll>
  );
}
