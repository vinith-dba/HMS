"use client";

import { useCallback, useEffect, useState } from "react";
import { PrimaryButton } from "@/components/portal/ui/primitives";
import { Icon } from "@/components/portal/ui/icons";
import { Spinner, Field } from "@/components/portal/ui/form-atoms";
import { PortalScroll } from "@/components/portal/portal-scroll";
import { api, ApiClientError } from "@/lib/api-client";

interface Bed { id: string; bedNo: string; status: string; patient: { displayId: string; fullName: string; ipNumber: string; admissionId: string } | null; }
interface Ward { id: string; name: string; category: string; floor: string | null; dailyCharge: string; gstRatePct: string; available: number; total: number; beds: Bed[]; }
interface Board { summary: { total: number; available: number; occupied: number; maintenance: number }; wards: Ward[]; }

const CATEGORIES = ["GENERAL", "SEMI_PRIVATE", "PRIVATE", "ICU"];
const emptyWard = { id: "", name: "", category: "GENERAL", floor: "", dailyCharge: "", gstRatePct: "0" };

function BedIcon({ tone }: { tone: string }) {
  return (
    <svg width="26" height="17" viewBox="0 0 48 32" fill="none" style={{ color: tone }} aria-hidden>
      <rect x="2" y="7" width="3.4" height="20" rx="1.4" fill="currentColor" opacity="0.9" />
      <rect x="4" y="15" width="40" height="9" rx="2.5" fill="currentColor" opacity="0.16" />
      <rect x="4" y="15" width="40" height="9" rx="2.5" stroke="currentColor" strokeWidth="1.6" />
      <rect x="7.5" y="10.5" width="11" height="6.5" rx="2" fill="currentColor" opacity="0.5" />
      <rect x="5" y="24" width="2.6" height="5" rx="1" fill="currentColor" opacity="0.9" />
      <rect x="40.4" y="24" width="2.6" height="5" rx="1" fill="currentColor" opacity="0.9" />
    </svg>
  );
}

export default function WardsPage() {
  const [board, setBoard] = useState<Board | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [wardModal, setWardModal] = useState<typeof emptyWard | null>(null);
  const [bedsModal, setBedsModal] = useState<{ wardId: string; wardName: string } | null>(null);
  const [bedCount, setBedCount] = useState("4");
  const [bedPrefix, setBedPrefix] = useState("");
  const [busy, setBusy] = useState(false);
  const [busyBed, setBusyBed] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setBoard(await api.get<Board>("/ipd/board")); }
    catch (e) { setError(e instanceof ApiClientError ? e.message : "Couldn't load wards."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  /** Idempotent — safe to press twice. */
  async function setupStandard() {
    setBusy(true); setError(null);
    try {
      const r = await api.post<{ wards: number; beds: number }>("/ipd/setup", {});
      setNotice(`${r.wards} wards and ${r.beds} beds created. Reception can admit now.`);
      await load();
    } catch (e) { setError(e instanceof ApiClientError ? e.message : "Could not create the wards."); }
    finally { setBusy(false); }
  }

  async function saveWard() {
    if (!wardModal) return;
    setBusy(true); setError(null);
    try {
      await api.post("/ipd/wards", {
        id: wardModal.id || undefined,
        name: wardModal.name,
        category: wardModal.category,
        floor: wardModal.floor || undefined,
        dailyCharge: Number(wardModal.dailyCharge || 0),
        gstRatePct: Number(wardModal.gstRatePct || 0),
      });
      setNotice(wardModal.id ? "Ward updated." : "Ward created — now add beds to it.");
      setWardModal(null);
      await load();
    } catch (e) { setError(e instanceof ApiClientError ? e.message : "Could not save ward."); }
    finally { setBusy(false); }
  }

  async function addBeds() {
    if (!bedsModal) return;
    setBusy(true); setError(null);
    try {
      await api.post("/ipd/beds", { wardId: bedsModal.wardId, count: Number(bedCount || 1), prefix: bedPrefix || undefined });
      setNotice(`${bedCount} bed(s) added to ${bedsModal.wardName}.`);
      setBedsModal(null); setBedCount("4"); setBedPrefix("");
      await load();
    } catch (e) { setError(e instanceof ApiClientError ? e.message : "Could not add beds."); }
    finally { setBusy(false); }
  }

  async function toggleMaintenance(bed: Bed) {
    setBusyBed(bed.id); setError(null);
    try {
      await api.post("/ipd/beds/status", { bedId: bed.id, status: bed.status === "MAINTENANCE" ? "AVAILABLE" : "MAINTENANCE" });
      await load();
    } catch (e) { setError(e instanceof ApiClientError ? e.message : "Could not update bed."); }
    finally { setBusyBed(null); }
  }

  const fld = "w-full rounded-lg border border-[var(--p-border)] bg-white px-3 py-2 text-sm text-[var(--p-ink)] outline-none focus:border-[var(--p-blue)]";

  return (
    <PortalScroll>
      <div data-rise className="surface dotgrid mb-6 flex flex-wrap items-center justify-between gap-4 px-6 py-5">
        <div>
          <h1 className="font-serif-p text-[22px] font-semibold text-[var(--p-ink)]">Wards &amp; beds</h1>
          <p className="mt-1 text-[13px] text-[var(--p-muted)]">
            Set the daily bed charge per ward. Rooms above ₹5,000/day (non-ICU) attract 5% GST — confirm rates with your CA.
          </p>
        </div>
        <PrimaryButton onClick={() => setWardModal({ ...emptyWard })}><Icon name="plus" size={15} /> New ward</PrimaryButton>
      </div>

      {notice && (
        <div data-rise className="mb-4 flex items-center justify-between rounded-lg border border-[var(--p-cyan)]/30 bg-[var(--p-cyan-soft)] px-4 py-3">
          <p className="text-[13px] font-medium text-[var(--p-cyan-deep)]">{notice}</p>
          <button onClick={() => setNotice(null)} className="text-[var(--p-cyan-deep)]">✕</button>
        </div>
      )}
      {error && !wardModal && !bedsModal && <div data-rise className="mb-4 rounded-lg border border-[var(--p-rose)]/25 bg-[var(--p-rose-soft)] px-4 py-3 text-[13px] text-[var(--p-rose)]">{error}</div>}

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-20 text-[13px] text-[var(--p-muted)]"><Spinner /> Loading…</div>
      ) : !board?.wards.length ? (
        <div data-rise className="surface dotgrid flex flex-col items-center px-6 py-16 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full border border-[var(--p-border)] bg-white text-[var(--p-muted)]"><Icon name="bed" size={20} /></span>
          <p className="mt-3 text-[14px] font-semibold text-[var(--p-ink)]">No wards yet — so reception has no beds to admit into.</p>
          <p className="mt-1 max-w-md text-[13px] leading-relaxed text-[var(--p-muted)]">
            Start with the standard layout and edit the rates afterwards, or build your own ward from scratch.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <button onClick={setupStandard} disabled={busy}
              className="inline-flex items-center gap-2 rounded-lg bg-[var(--p-blue)] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--p-blue-deep)] disabled:opacity-50">
              {busy ? <><Spinner /> Creating…</> : <><Icon name="check" size={15} /> Create standard wards (24 beds)</>}
            </button>
            <button onClick={() => setWardModal({ ...emptyWard })}
              className="inline-flex items-center gap-2 rounded-lg border border-[var(--p-border)] px-4 py-2.5 text-sm font-medium text-[var(--p-text)] hover:border-[var(--p-blue)] hover:text-[var(--p-blue)]">
              <Icon name="plus" size={14} /> Build my own
            </button>
          </div>
          <p className="mt-4 max-w-md text-[11px] leading-relaxed text-[var(--p-muted)]">
            General ₹1,500 ×10 · Semi-Private ₹3,000 ×6 · Private ₹5,500 ×4 (5% GST) · ICU ₹8,000 ×4.
            Room rent above ₹5,000/day attracts GST — confirm the rates with the CA.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {board.wards.map((w) => (
            <section key={w.id} data-rise className="surface overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--p-border)] px-6 py-4">
                <div>
                  <h3 className="text-[14px] font-semibold text-[var(--p-ink)]">{w.name} <span className="ml-1.5 text-[11px] font-medium text-[var(--p-muted)]">{w.category}{w.floor && ` · ${w.floor}`}</span></h3>
                  <p className="mt-0.5 text-[12px] text-[var(--p-muted)]">
                    ₹{w.dailyCharge}/day{Number(w.gstRatePct) > 0 ? ` + ${w.gstRatePct}% GST` : " · GST exempt"} · {w.available} of {w.total} free
                  </p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setWardModal({ id: w.id, name: w.name, category: w.category, floor: w.floor ?? "", dailyCharge: w.dailyCharge, gstRatePct: w.gstRatePct })}
                    className="rounded-lg border border-[var(--p-border)] px-3 py-1.5 text-[12px] font-medium text-[var(--p-blue)] hover:border-[var(--p-blue)]">Edit</button>
                  <button onClick={() => { setBedsModal({ wardId: w.id, wardName: w.name }); setBedPrefix(w.name.slice(0, 3).toUpperCase()); }}
                    className="btn-primary rounded-lg px-3 py-1.5 text-[12px] font-semibold text-white">+ Beds</button>
                </div>
              </div>
              {w.beds.length > 0 && (
                <div className="grid grid-cols-2 gap-3 p-5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                  {w.beds.map((b) => {
                    const occ = b.status === "OCCUPIED";
                    const maint = b.status === "MAINTENANCE";
                    const tone = occ ? "var(--p-blue-deep)" : maint ? "var(--p-muted)" : "var(--p-cyan-deep)";
                    return (
                      <button key={b.id} onClick={() => !occ && toggleMaintenance(b)} disabled={occ || busyBed === b.id}
                        title={occ ? `${b.patient?.fullName ?? "Occupied"} — discharge from reception` : maint ? "Click to bring back in service" : "Click to mark under maintenance"}
                        className={`flex min-h-[92px] flex-col rounded-xl border p-3 text-left transition-colors disabled:cursor-default ${
                          occ ? "border-[var(--p-blue)]/35 bg-[var(--p-blue-soft)]"
                          : maint ? "border-[var(--p-border)] bg-[var(--p-bg)]"
                          : "border-[var(--p-cyan)]/40 bg-[var(--p-cyan-soft)] hover:border-[var(--p-cyan)]"
                        }`}>
                        <div className="flex w-full items-center justify-between">
                          <span className="font-mono text-[13px] font-bold" style={{ color: tone }}>{b.bedNo}</span>
                          <BedIcon tone={tone} />
                        </div>
                        {occ && b.patient ? (
                          <div className="mt-auto pt-2">
                            <div className="truncate text-[12px] font-semibold text-[var(--p-ink)]">{b.patient.fullName}</div>
                            <div className="truncate font-mono text-[10px] text-[var(--p-muted)]">{b.patient.ipNumber} · {b.patient.displayId}</div>
                          </div>
                        ) : (
                          <div className="mt-auto pt-2 text-[11px] font-semibold" style={{ color: tone }}>
                            {busyBed === b.id ? "updating…" : maint ? "Maintenance" : "Free"}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </section>
          ))}
        </div>
      )}

      {/* ---- ward modal ---- */}
      {wardModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="surface w-full max-w-md overflow-hidden bg-white">
            <div className="flex items-center justify-between border-b border-[var(--p-border)] px-6 py-4">
              <h3 className="text-[15px] font-semibold text-[var(--p-ink)]">{wardModal.id ? "Edit ward" : "New ward"}</h3>
              <button onClick={() => setWardModal(null)} className="text-[var(--p-muted)]">✕</button>
            </div>
            <div className="space-y-4 p-6">
              <Field label="Ward name *"><input className={fld} value={wardModal.name} onChange={(e) => setWardModal({ ...wardModal, name: e.target.value })} placeholder="General Ward A" /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Category *">
                  <select className={fld} value={wardModal.category} onChange={(e) => setWardModal({ ...wardModal, category: e.target.value })}>
                    {CATEGORIES.map((c) => <option key={c} value={c}>{c.replace("_", " ")}</option>)}
                  </select>
                </Field>
                <Field label="Floor"><input className={fld} value={wardModal.floor} onChange={(e) => setWardModal({ ...wardModal, floor: e.target.value })} placeholder="1st floor" /></Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Daily charge (₹) *"><input className={fld} value={wardModal.dailyCharge} onChange={(e) => setWardModal({ ...wardModal, dailyCharge: e.target.value.replace(/[^\d.]/g, "") })} inputMode="decimal" /></Field>
                <Field label="GST %"><input className={fld} value={wardModal.gstRatePct} onChange={(e) => setWardModal({ ...wardModal, gstRatePct: e.target.value.replace(/[^\d.]/g, "") })} inputMode="decimal" /></Field>
              </div>
              <p className="rounded-lg bg-[var(--p-bg)] px-3 py-2.5 text-[11px] leading-relaxed text-[var(--p-muted)]">
                Non-ICU rooms above ₹5,000/day: 5% GST. ICU and rooms at or below ₹5,000: exempt (0%). The rate here applies to this ward&apos;s bed-charge line on discharge bills.
              </p>
            </div>
            {error && <div className="border-t border-[var(--p-border)] bg-[var(--p-rose-soft)] px-6 py-2.5 text-[12px] text-[var(--p-rose)]">{error}</div>}
            <div className="flex justify-end gap-3 border-t border-[var(--p-border)] p-5">
              <button onClick={() => setWardModal(null)} className="rounded-lg border border-[var(--p-border)] px-4 py-2 text-sm">Cancel</button>
              <PrimaryButton onClick={saveWard} disabled={busy || !wardModal.name.trim() || !wardModal.dailyCharge}>
                {busy ? <><Spinner /> Saving…</> : "Save ward"}
              </PrimaryButton>
            </div>
          </div>
        </div>
      )}

      {/* ---- add beds modal ---- */}
      {bedsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="surface w-full max-w-sm overflow-hidden bg-white">
            <div className="flex items-center justify-between border-b border-[var(--p-border)] px-6 py-4">
              <h3 className="text-[15px] font-semibold text-[var(--p-ink)]">Add beds — {bedsModal.wardName}</h3>
              <button onClick={() => setBedsModal(null)} className="text-[var(--p-muted)]">✕</button>
            </div>
            <div className="space-y-4 p-6">
              <div className="grid grid-cols-2 gap-3">
                <Field label="How many? *"><input className={fld} value={bedCount} onChange={(e) => setBedCount(e.target.value.replace(/\D/g, ""))} inputMode="numeric" /></Field>
                <Field label="Number prefix"><input className={fld} value={bedPrefix} onChange={(e) => setBedPrefix(e.target.value.toUpperCase())} placeholder="GEN" /></Field>
              </div>
              <p className="text-[11px] text-[var(--p-muted)]">Beds continue from the highest existing number — e.g. {bedPrefix || "GEN"}-05, {bedPrefix || "GEN"}-06…</p>
            </div>
            {error && <div className="border-t border-[var(--p-border)] bg-[var(--p-rose-soft)] px-6 py-2.5 text-[12px] text-[var(--p-rose)]">{error}</div>}
            <div className="flex justify-end gap-3 border-t border-[var(--p-border)] p-5">
              <button onClick={() => setBedsModal(null)} className="rounded-lg border border-[var(--p-border)] px-4 py-2 text-sm">Cancel</button>
              <PrimaryButton onClick={addBeds} disabled={busy || !bedCount}>{busy ? <><Spinner /> Adding…</> : "Add beds"}</PrimaryButton>
            </div>
          </div>
        </div>
      )}
    </PortalScroll>
  );
}
