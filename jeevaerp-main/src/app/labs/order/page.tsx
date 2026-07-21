"use client";

import { useEffect, useState } from "react";
import { PrimaryButton } from "@/components/portal/ui/primitives";
import { Icon } from "@/components/portal/ui/icons";
import { Spinner, SuccessCheck } from "@/components/portal/ui/form-atoms";
import { PortalScroll } from "@/components/portal/portal-scroll";
import { api, ApiClientError } from "@/lib/api-client";

interface Patient { id: string; displayId: string; fullName: string; age: number | null; phone: string; }
interface Cat { id: string; name: string; code: string | null; price: string; gstRatePct: string; }

const inits = (n: string) => n.split(" ").map((x) => x[0]).slice(0, 2).join("");

export default function OrderTestsPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Patient[]>([]);
  const [recent, setRecent] = useState<Patient[]>([]);
  const [searching, setSearching] = useState(false);
  const [patient, setPatient] = useState<Patient | null>(null);

  const [catalog, setCatalog] = useState<Cat[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState("");

  const [ordering, setOrdering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    api.get<{ catalog: Cat[] }>("/labs/catalog")
      .then((r) => setCatalog(r.catalog))
      .catch((e) => setLoadError(e instanceof ApiClientError ? e.message : "Couldn't load the test catalog."));
    api.get<{ patients: Patient[] }>("/reception/patients/recent")
      .then((r) => setRecent(r.patients))
      .catch((e) => setLoadError(e instanceof ApiClientError ? e.message : "Couldn't load patients."));
  }, []);

  useEffect(() => {
    if (patient || !query.trim()) { setResults([]); return; }
    let active = true; setSearching(true);
    const t = setTimeout(async () => {
      try { const { patients } = await api.get<{ patients: Patient[] }>(`/reception/patients?q=${encodeURIComponent(query)}&limit=6`); if (active) setResults(patients); }
      catch { if (active) setResults([]); } finally { if (active) setSearching(false); }
    }, 250);
    return () => { active = false; clearTimeout(t); };
  }, [query, patient]);

  const toggle = (id: string) => setPicked((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const shown = catalog.filter((c) => c.name.toLowerCase().includes(filter.toLowerCase()));
  const total = catalog.filter((c) => picked.has(c.id)).reduce((s, c) => s + Number(c.price), 0);

  async function order() {
    if (!patient || picked.size === 0) return;
    setError(null); setOrdering(true);
    try {
      await api.post("/labs/tests/order", { patientId: patient.id, catalogIds: [...picked] });
      setDone(true);
    } catch (e) { setError(e instanceof ApiClientError ? e.message : "Could not order tests."); }
    finally { setOrdering(false); }
  }

  function reset() { setDone(false); setPatient(null); setPicked(new Set()); setQuery(""); setFilter(""); setError(null); }

  if (done) {
    return (
      <div className="mx-auto max-w-md">
        <div className="surface flex flex-col items-center p-8 text-center">
          <SuccessCheck />
          <h3 className="mt-4 font-serif-p text-[22px] font-semibold text-[var(--p-ink)]">Tests ordered</h3>
          <p className="mt-1 text-[13px] text-[var(--p-muted)]">{picked.size} test{picked.size > 1 ? "s" : ""} added to the queue. Bill them from the Billing page.</p>
          <div className="mt-6 flex gap-3">
            <PrimaryButton onClick={reset}><Icon name="plus" size={15} /> Order more</PrimaryButton>
            <a href="/billing" className="inline-flex items-center gap-2 rounded-lg border border-[var(--p-border)] px-4 py-2.5 text-sm font-medium text-[var(--p-text)] hover:border-[var(--p-teal)] hover:text-[var(--p-teal)]">Go to billing</a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <PortalScroll>
      <div data-rise className="surface dotgrid mb-6 px-6 py-5">
        <h1 className="font-serif-p text-[22px] font-semibold text-[var(--p-ink)]">Order lab tests</h1>
        <p className="mt-1 text-[13px] text-[var(--p-muted)]">Walk-in tests don&apos;t need a doctor visit. Prices are snapshotted at order time.</p>
      </div>

      {loadError && (
        <div data-rise className="mb-4 flex items-start gap-2 rounded-lg border border-[var(--p-rose)]/25 bg-[var(--p-rose-soft)] px-4 py-3 text-[13px] text-[var(--p-rose)]">
          <Icon name="alert" size={15} /> <span>{loadError}</span>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          {/* patient */}
          <section data-rise className="surface overflow-hidden">
            <div className="border-b border-[var(--p-border)] px-6 py-4"><h3 className="text-[14px] font-semibold text-[var(--p-ink)]">1 · Patient</h3></div>
            <div className="p-6">
              {!patient ? (
                <>
                  <div className="flex items-center gap-2 rounded-lg border border-[var(--p-border)] px-3.5 py-2.5">
                    <Icon name="search" size={16} />
                    <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Name or JMH2026OP00123…" className="w-full text-sm outline-none" autoFocus />
                    {searching && <Spinner size={14} />}
                  </div>
                  {(query ? results : recent).length > 0 && (
                    <div className="mt-3 space-y-2">
                      {(query ? results : recent).map((p) => (
                        <button key={p.id} onClick={() => { setPatient(p); setQuery(""); }} className="surface-hover flex w-full items-center justify-between rounded-lg border border-[var(--p-border)] p-3 text-left">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--p-teal-soft)] font-serif-p text-[12px] font-semibold text-[var(--p-teal)]">{inits(p.fullName)}</div>
                            <div><div className="text-[13px] font-medium text-[var(--p-ink)]">{p.fullName}</div><div className="text-[11px] text-[var(--p-muted)]"><span className="tabular">{p.displayId}</span> · {p.phone}</div></div>
                          </div>
                          <Icon name="chevron" size={16} />
                        </button>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div className="flex items-center justify-between rounded-xl border border-[var(--p-teal)] bg-[var(--p-teal-soft)]/40 p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--p-teal)] font-serif-p text-[13px] font-semibold text-white">{inits(patient.fullName)}</div>
                    <div><div className="text-[14px] font-semibold text-[var(--p-ink)]">{patient.fullName}</div><div className="text-[11px] text-[var(--p-muted)]"><span className="tabular">{patient.displayId}</span> · {patient.phone}</div></div>
                  </div>
                  <button onClick={() => setPatient(null)} className="rounded-lg border border-[var(--p-border)] px-3 py-1.5 text-[12px] font-medium text-[var(--p-teal)]">Change</button>
                </div>
              )}
            </div>
          </section>

          {/* tests */}
          <section data-rise className={`surface overflow-hidden ${patient ? "" : "pointer-events-none opacity-55"}`}>
            <div className="flex items-center justify-between border-b border-[var(--p-border)] px-6 py-4">
              <h3 className="text-[14px] font-semibold text-[var(--p-ink)]">2 · Select tests</h3>
              <span className="badge">{picked.size} selected</span>
            </div>
            <div className="p-6">
              <div className="mb-4 flex items-center gap-2 rounded-lg border border-[var(--p-border)] px-3.5 py-2.5">
                <Icon name="search" size={15} />
                <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter tests…" className="w-full text-sm outline-none" />
              </div>
              <div className="max-h-[420px] space-y-2 overflow-y-auto overscroll-contain pr-1">
                {shown.map((c) => {
                  const on = picked.has(c.id);
                  return (
                    <button key={c.id} onClick={() => toggle(c.id)}
                      className={`flex w-full items-center justify-between rounded-lg border p-3 text-left transition-colors ${on ? "border-[var(--p-teal)] bg-[var(--p-teal-soft)]/40" : "border-[var(--p-border)] hover:border-[var(--p-teal)]"}`}>
                      <div className="flex items-center gap-3">
                        <span className={`flex h-5 w-5 items-center justify-center rounded border ${on ? "border-[var(--p-teal)] bg-[var(--p-teal)] text-white" : "border-[var(--p-border)]"}`}>
                          {on && <Icon name="check" size={12} />}
                        </span>
                        <div>
                          <div className="text-[13px] font-medium text-[var(--p-ink)]">{c.name}</div>
                          <div className="text-[11px] text-[var(--p-muted)]">
                            {c.code && <span className="font-mono">{c.code}</span>}
                            {Number(c.gstRatePct) === 0 ? " · GST exempt" : ` · GST ${c.gstRatePct}%`}
                          </div>
                        </div>
                      </div>
                      <span className="font-mono text-[13px] font-semibold text-[var(--p-ink)]">₹{c.price}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>
        </div>

        {/* summary */}
        <aside data-rise className="lg:sticky lg:top-6 lg:self-start">
          <div className="surface overflow-hidden">
            <div className="border-b border-[var(--p-border)] px-5 py-4"><p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--p-ink)]">Order summary</p></div>
            <div className="max-h-64 divide-y divide-[var(--p-border)] overflow-y-auto">
              {picked.size === 0 ? (
                <p className="px-5 py-8 text-center text-[12px] text-[var(--p-muted)]">No tests selected.</p>
              ) : catalog.filter((c) => picked.has(c.id)).map((c) => (
                <div key={c.id} className="flex items-center justify-between px-5 py-3">
                  <span className="text-[12px] text-[var(--p-text)]">{c.name}</span>
                  <span className="font-mono text-[12px] text-[var(--p-ink)]">₹{c.price}</span>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between border-t border-[var(--p-border)] px-5 py-3.5">
              <span className="text-[13px] font-semibold text-[var(--p-ink)]">Estimated total</span>
              <span className="font-mono text-[15px] font-semibold text-[var(--p-teal)]">₹{total.toFixed(2)}</span>
            </div>
            {error && <div className="border-t border-[var(--p-border)] bg-[var(--p-rose-soft)] px-5 py-3 text-[12px] text-[var(--p-rose)]">{error}</div>}
            <div className="border-t border-[var(--p-border)] p-5">
              <PrimaryButton onClick={order} disabled={!patient || picked.size === 0 || ordering} full>
                {ordering ? <><Spinner /> Ordering…</> : <><Icon name="flask" size={15} /> Order {picked.size || ""} test{picked.size === 1 ? "" : "s"}</>}
              </PrimaryButton>
              <p className="mt-3 text-center text-[11px] text-[var(--p-muted)]">GST is applied at billing, per the catalog rate.</p>
            </div>
          </div>
        </aside>
      </div>
    </PortalScroll>
  );
}
