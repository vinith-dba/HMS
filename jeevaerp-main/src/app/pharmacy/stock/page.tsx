"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PrimaryButton } from "@/components/portal/ui/primitives";
import { Icon } from "@/components/portal/ui/icons";
import { Spinner, Field } from "@/components/portal/ui/form-atoms";
import { PortalScroll } from "@/components/portal/portal-scroll";
import { BatchImport } from "@/components/portal/pharmacy/batch-import";
import { api, ApiClientError } from "@/lib/api-client";

interface Med {
  id: string; name: string; genericName: string | null; manufacturer: string | null;
  unit: string; gstRatePct: string; inStock: number; expiredQty: number; mrp: string | null;
  nearestExpiry: string | null; lowStock: boolean; reorderThreshold: number;
  rackLocation: string | null; hsnCode: string | null; active: boolean; courseCritical: boolean;
}
interface Batch { id: string; batchNo: string; expiryDate: string; quantity: number; mrp: string; rate: string | null; margin: string | null; marginPct: number | null; expired: boolean; }

const blankMed = { id: "", name: "", genericName: "", manufacturer: "", hsnCode: "", gstRatePct: "5", unit: "tablet", reorderThreshold: "10", rackLocation: "", active: true, courseCritical: false };
const blankBatch = { batchNo: "", expiryDate: "", quantity: "", mrp: "", purchasePrice: "", supplierRef: "" };

/** Fixed reasons keep the stock ledger auditable. Free text invites "adj" and "fix". */
const REMOVE_REASONS = ["Expired — pulled from shelf", "Damaged / broken", "Spillage", "Returned to supplier", "Stock count correction"];
const EXPIRY_WARN_DAYS = 90;

const daysUntil = (iso: string) => {
  const t = new Date(); t.setHours(0, 0, 0, 0);
  return Math.round((new Date(iso + "T00:00:00").getTime() - t.getTime()) / 86400000);
};
const dmy = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(2, 4)}`;

/** Nobody should do date arithmetic at a counter. */
function expiry(iso: string | null): { text: string; sub: string; tone: "ok" | "warn" | "bad" | "none" } {
  if (!iso) return { text: "—", sub: "no stock", tone: "none" };
  const d = daysUntil(iso);
  if (d < 0) return { text: "Expired", sub: dmy(iso), tone: "bad" };
  if (d === 0) return { text: "Today", sub: dmy(iso), tone: "bad" };
  if (d <= 30) return { text: `${d}d left`, sub: dmy(iso), tone: "bad" };
  if (d <= EXPIRY_WARN_DAYS) return { text: `${Math.round(d / 30)} mo left`, sub: dmy(iso), tone: "warn" };
  return { text: dmy(iso), sub: `${Math.round(d / 30)} mo`, tone: "ok" };
}

type Tab = "ALL" | "LOW" | "EXPIRING" | "PULL" | "OUT";
type View = "LIST" | "RACK";

export default function StockPage() {
  const [meds, setMeds] = useState<Med[]>([]);
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<Tab>("ALL");
  const [view, setView] = useState<View>("LIST");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const [expanded, setExpanded] = useState<string | null>(null);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [batchesLoading, setBatchesLoading] = useState(false);

  const [receiving, setReceiving] = useState<Med | null>(null);
  const [bf, setBf] = useState({ ...blankBatch });
  const [editMed, setEditMed] = useState<typeof blankMed | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [remove, setRemove] = useState<{ med: Med; batch: Batch } | null>(null);
  const [rmQty, setRmQty] = useState("");
  const [rmReason, setRmReason] = useState(REMOVE_REASONS[0]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { const { medicines } = await api.get<{ medicines: Med[] }>(`/pharmacy/medicines${q ? `?q=${encodeURIComponent(q)}` : ""}`); setMeds(medicines); }
    catch (e) { setError(e instanceof ApiClientError ? e.message : "Couldn't load stock."); }
    finally { setLoading(false); }
  }, [q]);
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);

  // "/" focuses search — hands stay on the keyboard during a rush
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === "/" && document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "SELECT") {
        e.preventDefault(); searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, []);

  // Escape closes whichever modal is open — never mid-save, so a request in
  // flight can't be orphaned by a stray key press.
  useEffect(() => {
    if (!receiving && !remove && !editMed) return;
    const onEsc = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || busy) return;
      setReceiving(null); setRemove(null); setEditMed(null);
    };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [receiving, remove, editMed, busy]);

  const counts = useMemo(() => ({
    ALL: meds.length,
    LOW: meds.filter((m) => m.lowStock && m.inStock > 0).length,
    EXPIRING: meds.filter((m) => m.nearestExpiry && daysUntil(m.nearestExpiry) >= 0 && daysUntil(m.nearestExpiry) <= EXPIRY_WARN_DAYS).length,
    PULL: meds.filter((m) => m.expiredQty > 0).length,
    OUT: meds.filter((m) => m.inStock === 0).length,
  }), [meds]);

  const shown = useMemo(() => {
    switch (tab) {
      case "LOW": return meds.filter((m) => m.lowStock && m.inStock > 0);
      case "EXPIRING": return meds.filter((m) => m.nearestExpiry && daysUntil(m.nearestExpiry) >= 0 && daysUntil(m.nearestExpiry) <= EXPIRY_WARN_DAYS);
      case "PULL": return meds.filter((m) => m.expiredQty > 0);
      case "OUT": return meds.filter((m) => m.inStock === 0);
      default: return meds;
    }
  }, [meds, tab]);

  /** Group by physical rack — this is the order you actually walk the shelves in. */
  const racks = useMemo(() => {
    const map = new Map<string, Med[]>();
    for (const m of shown) {
      const key = m.rackLocation?.trim().toUpperCase() || "UNASSIGNED";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(m);
    }
    return [...map.entries()].sort(([a], [b]) =>
      a === "UNASSIGNED" ? 1 : b === "UNASSIGNED" ? -1 : a.localeCompare(b, undefined, { numeric: true })
    );
  }, [shown]);

  async function toggle(m: Med) {
    if (expanded === m.id) { setExpanded(null); return; }
    setExpanded(m.id); setBatches([]); setBatchesLoading(true); // clear first — no stale batches flashing
    try { const r = await api.get<{ batches: Batch[] }>(`/pharmacy/medicines/${m.id}/batches`); setBatches(r.batches); }
    catch { setBatches([]); }
    finally { setBatchesLoading(false); }
  }

  async function receive() {
    if (!receiving) return;
    setBusy(true); setError(null);
    try {
      await api.post("/pharmacy/batches", {
        medicineId: receiving.id, batchNo: bf.batchNo, expiryDate: bf.expiryDate,
        quantity: Number(bf.quantity), mrp: Number(bf.mrp),
        purchasePrice: bf.purchasePrice ? Number(bf.purchasePrice) : undefined,
        supplierRef: bf.supplierRef || undefined,
      });
      setFlash(`Received ${bf.quantity} ${receiving.unit}s of ${receiving.name}.`);
      setReceiving(null); setBf({ ...blankBatch }); setExpanded(null); await load();
    } catch (e) { setError(e instanceof ApiClientError ? e.message : "Could not receive stock."); }
    finally { setBusy(false); }
  }

  /** Write-off. The endpoint existed from day one; nothing ever called it. */
  async function saveRemove() {
    if (!remove) return;
    const qty = Number(rmQty);
    if (!qty || qty <= 0) return;
    setBusy(true); setError(null);
    try {
      await api.post("/pharmacy/adjust", { batchId: remove.batch.id, delta: -qty, reason: rmReason });
      setFlash(`Removed ${qty} ${remove.med.unit}s from batch ${remove.batch.batchNo} — ${rmReason.toLowerCase()}.`);
      const med = remove.med;
      setRemove(null); setRmQty(""); setRmReason(REMOVE_REASONS[0]);
      await load();
      setExpanded(null); await toggle(med); // stay on the same medicine to clear the next batch
    } catch (e) { setError(e instanceof ApiClientError ? e.message : "Could not adjust stock."); }
    finally { setBusy(false); }
  }

  async function saveMed() {
    if (!editMed) return;
    setBusy(true); setError(null);
    try {
      await api.post("/pharmacy/medicines", {
        id: editMed.id || undefined, name: editMed.name,
        genericName: editMed.genericName || undefined, manufacturer: editMed.manufacturer || undefined,
        hsnCode: editMed.hsnCode || undefined, gstRatePct: Number(editMed.gstRatePct),
        unit: editMed.unit, reorderThreshold: Number(editMed.reorderThreshold),
        rackLocation: editMed.rackLocation || undefined, active: editMed.active,
        courseCritical: editMed.courseCritical,
      });
      setFlash(`${editMed.name} saved.`);
      setEditMed(null); await load();
    } catch (e) { setError(e instanceof ApiClientError ? e.message : "Could not save."); }
    finally { setBusy(false); }
  }

  const openEdit = (m: Med) => setEditMed({
    id: m.id, name: m.name, genericName: m.genericName ?? "",
    manufacturer: m.manufacturer ?? "",  // was hardcoded "" — every edit WIPED the manufacturer
    hsnCode: m.hsnCode ?? "", gstRatePct: m.gstRatePct, unit: m.unit,
    reorderThreshold: String(m.reorderThreshold), rackLocation: m.rackLocation ?? "",
    active: m.active,                    // was hardcoded true — a discontinued medicine silently came back
    courseCritical: m.courseCritical,
  });

  const fld = "w-full rounded-lg border border-[var(--p-border)] bg-white px-3 py-2 text-sm text-[var(--p-ink)] outline-none transition-colors focus:border-[var(--p-blue)]";
  const TABS: { k: Tab; label: string; tone?: "warn" | "bad" }[] = [
    { k: "ALL", label: "All" },
    { k: "LOW", label: "Reorder", tone: "warn" },
    { k: "EXPIRING", label: "Expiring", tone: "warn" },
    { k: "PULL", label: "Pull off shelf", tone: "bad" },
    { k: "OUT", label: "Out of stock", tone: "bad" },
  ];

  const Row = ({ m, i, hideRack }: { m: Med; i: number; hideRack?: boolean }) => {
    const e = expiry(m.nearestExpiry);
    const out = m.inStock === 0;
    const open = expanded === m.id;
    // meter reads full at 3x the reorder line — the shape tells you "comfortable" at a glance
    const pct = Math.min(100, Math.round((m.inStock / Math.max(1, m.reorderThreshold * 3)) * 100));
    return (
      <div className="stk-row" style={{ ["--d" as string]: `${Math.min(i, 12) * 22}ms` }}>
        <div className={`stk-hit grid items-center gap-x-4 gap-y-3 px-5 py-3.5 ${open ? "is-open" : ""}`}>
          <button onClick={() => toggle(m)} className="col-[1] flex min-w-0 items-center gap-3 text-left">
            <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-[10px] transition-colors ${out ? "bg-[var(--p-rose-soft)] text-[var(--p-rose)]" : "bg-[var(--p-cyan-soft)] text-[var(--p-cyan-deep)]"}`}>
              <Icon name="pill" size={17} />
            </span>
            <span className="min-w-0">
              <span className="rx-name block truncate text-[14px] font-semibold tracking-[-0.01em] text-[var(--p-ink)]">{m.name}</span>
              <span className="block truncate text-[12px] text-[var(--p-muted)]">
                {m.genericName || m.manufacturer || `GST ${m.gstRatePct}%`}
              </span>
            </span>
          </button>

          {!hideRack && (
            <div className="col-[2] hidden md:block">
              <span className="lbl">Rack</span>
              {m.rackLocation ? <span className="bin">{m.rackLocation}</span>
                : <span className="bin bin-empty">—</span>}
            </div>
          )}

          <div className={`${hideRack ? "col-[2]" : "col-[3]"} min-w-[128px]`}>
            <span className="lbl">In stock</span>
            <div className={`num text-[16px] font-bold ${out ? "text-[var(--p-rose)]" : m.lowStock ? "text-[var(--p-amber)]" : "text-[var(--p-ink)]"}`}>
              {m.inStock}<span className="ml-1 text-[11px] font-medium text-[var(--p-muted)]">{m.unit}s</span>
            </div>
            <div className="meter mt-1.5" aria-hidden>
              <i style={{ width: `${pct}%`, background: out ? "var(--p-rose)" : m.lowStock ? "var(--p-amber)" : "var(--p-cyan)" }} />
            </div>
            <div className="mt-1 text-[10px] font-semibold text-[var(--p-muted)]">
              {out ? <span className="text-[var(--p-rose)]">Out of stock</span>
                : m.lowStock ? <span className="text-[var(--p-amber)]">Below {m.reorderThreshold} — reorder</span>
                : <>Reorder at {m.reorderThreshold}</>}
            </div>
          </div>

          <div className={`${hideRack ? "col-[3]" : "col-[4]"} min-w-[104px]`}>
            <span className="lbl">Next expiry</span>
            <span className={`exp exp-${e.tone}`}>{e.text}</span>
            <div className="num mt-1 text-[10px] text-[var(--p-muted)]">{e.sub}</div>
          </div>

          <div className={`${hideRack ? "col-[4]" : "col-[5]"} flex shrink-0 items-center gap-2 justify-self-end`}>
            <button onClick={() => { setReceiving(m); setBf({ ...blankBatch }); }}
              className="btn-primary rounded-md px-3 py-1.5 text-[12px] font-semibold text-white">Receive</button>
            <button onClick={() => openEdit(m)}
              className="rounded-md border border-[var(--p-border)] px-3 py-1.5 text-[12px] font-medium text-[var(--p-blue)] transition-colors hover:border-[var(--p-blue)]">Edit</button>
            <button onClick={() => toggle(m)} aria-label="Show batches" aria-expanded={open}
              className={`grid h-8 w-8 place-items-center rounded-md border border-[var(--p-border)] text-[var(--p-muted)] transition-all hover:border-[var(--p-blue)] hover:text-[var(--p-blue)] ${open ? "rotate-90 border-[var(--p-blue)] text-[var(--p-blue)]" : ""}`}>
              <Icon name="chevron" size={14} />
            </button>
          </div>
        </div>

        {m.expiredQty > 0 && (
          <button onClick={() => toggle(m)} className="pull-strip">
            <Icon name="alert" size={14} />
            <span><b>{m.expiredQty} {m.unit}s expired</b> and still sitting on the shelf — open batches and remove them.</span>
          </button>
        )}

        {open && (
          <div className="border-t border-[var(--p-border)] bg-[var(--p-bg)] px-5 py-4">
            <p className="mb-2.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--p-muted)]">
              <Icon name="clock" size={12} /> Batches · the oldest expiry is always dispensed first
            </p>
            {batchesLoading ? (
              <div className="flex items-center gap-2 py-3 text-[12px] text-[var(--p-muted)]"><Spinner size={14} /> Loading batches…</div>
            ) : batches.length === 0 ? (
              <p className="py-3 text-[12px] text-[var(--p-muted)]">No batches yet — use <b>Receive</b> to add one.</p>
            ) : (
              <div className="space-y-1.5">
                {batches.map((b, bi) => (
                  <div key={b.id} className={`batch ${b.expired ? "batch-dead" : ""}`}>
                    {!b.expired && bi === 0 && <span className="fefo">Next out</span>}
                    <span className="num w-[118px] text-[12px] font-semibold text-[var(--p-ink)]">{b.batchNo}</span>
                    <span className="w-[120px] text-[12px] text-[var(--p-muted)]">
                      Exp <span className={`num ${b.expired ? "font-semibold text-[var(--p-rose)]" : "text-[var(--p-ink)]"}`}>{dmy(b.expiryDate)}</span>
                    </span>
                    <span className="w-[92px] text-[12px]">
                      <span className="num font-semibold text-[var(--p-ink)]">{b.quantity}</span>
                      <span className="text-[var(--p-muted)]"> {m.unit}s</span>
                    </span>
                    <span className="flex flex-wrap items-center gap-x-1 gap-y-0.5 text-[12px]">
                      <span className="text-[var(--p-muted)]">MRP</span><span className="num font-semibold text-[var(--p-ink)]">₹{b.mrp}</span>
                      {b.rate != null && <><span className="text-[var(--p-muted)]">· rate</span><span className="num text-[var(--p-ink)]">₹{b.rate}</span></>}
                      {b.margin != null && <span className="num rounded bg-[var(--p-teal-soft)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--p-teal-deep)]">+₹{b.margin}{b.marginPct != null ? ` · ${b.marginPct}%` : ""}</span>}
                    </span>
                    {b.expired && <span className="dead-tag">Expired</span>}
                    <button onClick={() => { setRemove({ med: m, batch: b }); setRmQty(String(b.quantity)); setRmReason(b.expired ? REMOVE_REASONS[0] : REMOVE_REASONS[1]); }}
                      className="ml-auto rounded-lg border border-[var(--p-border)] px-2.5 py-1 text-[11px] font-medium text-[var(--p-rose)] transition-colors hover:border-[var(--p-rose)] hover:bg-[var(--p-rose-soft)]">
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <PortalScroll>
      <style>{CSS}</style>

      <div data-rise className="surface dotgrid mb-5 flex flex-wrap items-end justify-between gap-4 px-6 py-5">
        <div>
          <h1 className="font-serif-p text-[22px] font-semibold tracking-[-0.02em] text-[var(--p-ink)]">Medicine stock</h1>
          <p className="mt-1 max-w-[560px] text-[13px] leading-relaxed text-[var(--p-muted)]">
            What&apos;s on the shelf, what to reorder, and what to pull. Oldest stock always goes out first.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => setShowImport(true)}
            className="inline-flex items-center gap-2 rounded-md border border-[var(--p-border-strong)] bg-white px-4 py-2.5 text-[13px] font-semibold text-[var(--p-ink)] transition-colors hover:border-[var(--p-blue)] hover:text-[var(--p-blue)]">
            <Icon name="file" size={15} /> Import batches
          </button>
          <PrimaryButton onClick={() => setEditMed({ ...blankMed })}><Icon name="plus" size={15} /> Add medicine</PrimaryButton>
        </div>
      </div>

      {showImport && (
        <BatchImport
          meds={meds.map((m) => ({ id: m.id, name: m.name, genericName: m.genericName }))}
          onClose={() => setShowImport(false)}
          onDone={(created) => { setFlash(`Imported ${created} ${created === 1 ? "batch" : "batches"} into stock.`); load(); }}
        />
      )}

      <div data-rise className="mb-4 flex flex-wrap items-center gap-2">
        {TABS.map((t) => {
          const n = counts[t.k];
          const on = tab === t.k;
          const urgent = n > 0 ? t.tone : undefined;
          return (
            <button key={t.k} onClick={() => setTab(t.k)}
              className={`seg ${on ? "seg-on" : ""} ${!on && urgent === "bad" ? "seg-bad" : ""} ${!on && urgent === "warn" ? "seg-warn" : ""}`}>
              {t.label}
              <span className="seg-n num">{n}</span>
            </button>
          );
        })}

        <div className="ml-auto flex items-center gap-1 rounded-[10px] border border-[var(--p-border)] bg-white p-0.5">
          {(["LIST", "RACK"] as View[]).map((v) => (
            <button key={v} onClick={() => setView(v)}
              className={`rounded-[6px] px-3 py-1.5 text-[12px] font-semibold transition-colors ${view === v ? "bg-[var(--p-blue)] text-white" : "text-[var(--p-muted)] hover:text-[var(--p-ink)]"}`}>
              {v === "LIST" ? "A–Z" : "By rack"}
            </button>
          ))}
        </div>
      </div>

      <div data-rise className="surface mb-4 flex max-w-md items-center gap-2 px-3.5 py-2.5">
        <Icon name="search" size={16} />
        <input ref={searchRef} value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name or generic…" className="w-full bg-transparent text-sm outline-none" />
        {loading ? <Spinner size={14} /> : <kbd className="kbd">/</kbd>}
      </div>

      {flash && (
        <div data-rise className="mb-4 flex items-center justify-between rounded-lg border border-[var(--p-cyan)]/30 bg-[var(--p-cyan-soft)] px-4 py-3 text-[13px] font-medium text-[var(--p-cyan-deep)]">
          <span className="flex items-center gap-2"><Icon name="check" size={15} /> {flash}</span>
          <button onClick={() => setFlash(null)} aria-label="Dismiss">✕</button>
        </div>
      )}
      {error && <div data-rise className="mb-4 rounded-lg border border-[var(--p-rose)]/25 bg-[var(--p-rose-soft)] px-4 py-3 text-[13px] text-[var(--p-rose)]">{error}</div>}

      {shown.length === 0 && !loading ? (
        <section data-rise className="surface grid place-items-center px-6 py-20 text-center">
          <span className="grid h-12 w-12 place-items-center rounded-xl bg-[var(--p-cyan-soft)] text-[var(--p-cyan-deep)]"><Icon name="check" size={22} /></span>
          <p className="mt-3 text-[14px] font-semibold text-[var(--p-ink)]">
            {tab === "ALL" ? "No medicines found." : "Nothing here — that's good news."}
          </p>
          <p className="mt-1 text-[12px] text-[var(--p-muted)]">
            {tab === "ALL" ? "Try a different search, or add a medicine." : "This list is empty because nothing needs your attention."}
          </p>
        </section>
      ) : view === "LIST" ? (
        <section data-rise className="surface overflow-hidden">
          <div className="divide-y divide-[var(--p-border)]">
            {shown.map((m, i) => <Row key={m.id} m={m} i={i} />)}
          </div>
        </section>
      ) : (
        <div className="space-y-4">
          {racks.map(([rack, items], ri) => {
            const low = items.filter((m) => m.lowStock || m.inStock === 0).length;
            const pull = items.reduce((s, m) => s + (m.expiredQty > 0 ? 1 : 0), 0);
            return (
              <section key={rack} data-rise className="surface overflow-hidden">
                <div className="flex flex-wrap items-center gap-3 border-b border-[var(--p-border)] bg-[var(--p-bg)] px-5 py-3">
                  {/* the shelf, drawn — how full it is, and whether anything on it is dead */}
                  <ShelfGlyph
                    label={rack === "UNASSIGNED" ? "?" : rack}
                    filled={items.length}
                    lowCount={low}
                    deadCount={pull}
                    unassigned={rack === "UNASSIGNED"}
                  />
                  <div className="min-w-0">
                    <div className="text-[13px] font-semibold text-[var(--p-ink)]">
                      {rack === "UNASSIGNED" ? "No rack assigned" : `Rack ${rack}`}
                    </div>
                    <div className="text-[11px] text-[var(--p-muted)]">
                      {items.length} medicine{items.length === 1 ? "" : "s"}
                      {low > 0 && <> · <span className="font-semibold text-[var(--p-amber)]">{low} to reorder</span></>}
                      {pull > 0 && <> · <span className="font-semibold text-[var(--p-rose)]">{pull} to pull</span></>}
                    </div>
                  </div>
                  {rack === "UNASSIGNED" && (
                    <span className="ml-auto text-[11px] text-[var(--p-muted)]">Set a rack in <b>Edit</b> so staff can find these.</span>
                  )}
                </div>
                <div className="divide-y divide-[var(--p-border)]">
                  {items.map((m, i) => <Row key={m.id} m={m} i={ri === 0 ? i : 0} hideRack />)}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {/* RECEIVE */}
      {receiving && (
        <div className="modal-veil" onClick={(e) => { if (e.target === e.currentTarget && !busy) setReceiving(null); }}>
          <div className="surface w-full max-w-md bg-white">
            <div className="border-b border-[var(--p-border)] px-6 py-4">
              <h3 className="text-[14px] font-semibold text-[var(--p-ink)]">Receive stock</h3>
              <p className="mt-0.5 text-[12px] text-[var(--p-muted)]">
                {receiving.name} · counted in {receiving.unit}s
                {receiving.rackLocation && <> · goes to rack <b className="num text-[var(--p-ink)]">{receiving.rackLocation}</b></>}
              </p>
            </div>
            <div className="grid gap-4 p-6 sm:grid-cols-2">
              <Field label="Batch number"><input className={fld} value={bf.batchNo} onChange={(e) => setBf({ ...bf, batchNo: e.target.value })} placeholder="Printed on the strip" autoFocus /></Field>
              <Field label="Expiry date"><input type="date" className={fld} value={bf.expiryDate} onChange={(e) => setBf({ ...bf, expiryDate: e.target.value })} /></Field>
              <Field label={`Quantity (${receiving.unit}s)`}><input className={fld} value={bf.quantity} onChange={(e) => setBf({ ...bf, quantity: e.target.value.replace(/\D/g, "") })} inputMode="numeric" /></Field>
              <Field label="MRP (₹)"><input className={fld} value={bf.mrp} onChange={(e) => setBf({ ...bf, mrp: e.target.value.replace(/[^\d.]/g, "") })} inputMode="decimal" /></Field>
              <Field label="Purchase price (₹)"><input className={fld} value={bf.purchasePrice} onChange={(e) => setBf({ ...bf, purchasePrice: e.target.value.replace(/[^\d.]/g, "") })} inputMode="decimal" /></Field>
              <Field label="Supplier invoice"><input className={fld} value={bf.supplierRef} onChange={(e) => setBf({ ...bf, supplierRef: e.target.value })} /></Field>
            </div>
            <p className="mx-6 mb-4 rounded-lg bg-[var(--p-blue-soft)] px-3 py-2 text-[11px] text-[var(--p-blue-deep)]">
              Patients are billed at MRP. Expired batches can never be dispensed, even by mistake.
            </p>
            <div className="flex justify-end gap-3 border-t border-[var(--p-border)] p-5">
              <button onClick={() => setReceiving(null)} className="rounded-lg border border-[var(--p-border)] px-4 py-2 text-sm text-[var(--p-text)]">Cancel</button>
              <PrimaryButton onClick={receive} disabled={busy || !bf.batchNo || !bf.expiryDate || !bf.quantity || !bf.mrp}>
                {busy ? <><Spinner /> Saving…</> : <><Icon name="check" size={15} /> Receive</>}
              </PrimaryButton>
            </div>
          </div>
        </div>
      )}

      {/* REMOVE STOCK */}
      {remove && (
        <div className="modal-veil" onClick={(e) => { if (e.target === e.currentTarget && !busy) setRemove(null); }}>
          <div className="surface w-full max-w-sm bg-white">
            <div className="border-b border-[var(--p-border)] px-6 py-4">
              <h3 className="text-[14px] font-semibold text-[var(--p-ink)]">Remove stock</h3>
              <p className="mt-0.5 text-[12px] text-[var(--p-muted)]">
                {remove.med.name} · batch <span className="num">{remove.batch.batchNo}</span> · {remove.batch.quantity} {remove.med.unit}s on hand
              </p>
            </div>
            <div className="space-y-4 p-6">
              <Field label={`How many ${remove.med.unit}s?`}>
                <input className={fld} value={rmQty} inputMode="numeric" autoFocus
                  onChange={(e) => setRmQty(e.target.value.replace(/\D/g, ""))} />
              </Field>
              <Field label="Why?">
                <select className={fld} value={rmReason} onChange={(e) => setRmReason(e.target.value)}>
                  {REMOVE_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </Field>
              <p className="rounded-lg bg-[var(--p-amber-soft)] px-3 py-2 text-[11px] leading-relaxed text-[#8a6414]">
                Recorded against your name in the stock ledger. This is <b>not a sale</b> — no bill is raised, the shelf count just drops.
              </p>
            </div>
            <div className="flex justify-end gap-3 border-t border-[var(--p-border)] p-5">
              <button onClick={() => setRemove(null)} className="rounded-lg border border-[var(--p-border)] px-4 py-2 text-sm text-[var(--p-text)]">Cancel</button>
              <button onClick={saveRemove}
                disabled={busy || !rmQty || Number(rmQty) <= 0 || Number(rmQty) > remove.batch.quantity}
                className="inline-flex items-center gap-2 rounded-lg bg-[var(--p-rose)] px-4 py-2 text-sm font-semibold text-white transition-opacity disabled:opacity-40">
                {busy ? <><Spinner /> Removing…</> : <>Remove {rmQty || 0}</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD / EDIT MEDICINE */}
      {editMed && (
        <div className="modal-veil" onClick={(e) => { if (e.target === e.currentTarget && !busy) setEditMed(null); }}>
          <div className="surface w-full max-w-md bg-white">
            <div className="border-b border-[var(--p-border)] px-6 py-4">
              <h3 className="text-[14px] font-semibold text-[var(--p-ink)]">{editMed.id ? "Edit medicine" : "Add medicine"}</h3>
              <p className="mt-0.5 text-[12px] text-[var(--p-muted)]">Details only — to change quantities use <b>Receive</b> or <b>Remove</b>.</p>
            </div>
            <div className="grid gap-4 p-6 sm:grid-cols-2">
              <Field label="Name" span><input className={fld} value={editMed.name} onChange={(e) => setEditMed({ ...editMed, name: e.target.value })} autoFocus /></Field>
              <Field label="Generic name"><input className={fld} value={editMed.genericName} onChange={(e) => setEditMed({ ...editMed, genericName: e.target.value })} /></Field>
              <Field label="Manufacturer"><input className={fld} value={editMed.manufacturer} onChange={(e) => setEditMed({ ...editMed, manufacturer: e.target.value })} /></Field>
              <Field label="HSN code"><input className={fld} value={editMed.hsnCode} onChange={(e) => setEditMed({ ...editMed, hsnCode: e.target.value })} /></Field>
              <Field label="GST %"><input className={fld} value={editMed.gstRatePct} onChange={(e) => setEditMed({ ...editMed, gstRatePct: e.target.value.replace(/[^\d.]/g, "") })} inputMode="decimal" /></Field>
              <Field label="Unit (tablet, bottle…)"><input className={fld} value={editMed.unit} onChange={(e) => setEditMed({ ...editMed, unit: e.target.value })} /></Field>
              <Field label="Warn me below"><input className={fld} value={editMed.reorderThreshold} onChange={(e) => setEditMed({ ...editMed, reorderThreshold: e.target.value.replace(/\D/g, "") })} inputMode="numeric" /></Field>
              <Field label="Rack / box"><input className={fld} value={editMed.rackLocation} onChange={(e) => setEditMed({ ...editMed, rackLocation: e.target.value.toUpperCase() })} placeholder="A1" /></Field>
            </div>
            {editMed.id && (
              <label className="mx-6 mb-4 flex items-start gap-2.5 rounded-lg border border-[var(--p-border)] px-3 py-2.5 text-[12px] leading-relaxed text-[var(--p-text)]">
                <input type="checkbox" checked={editMed.active} onChange={(e) => setEditMed({ ...editMed, active: e.target.checked })} className="mt-0.5 h-4 w-4 accent-[var(--p-blue)]" />
                <span>Still stocked. Untick to discontinue — it leaves the counter, but its billing history stays intact.</span>
              </label>
            )}
            <label className="mx-6 mb-3 flex cursor-pointer items-start gap-2.5 rounded-lg border border-[var(--p-border)] px-3 py-2.5 text-[12px] leading-relaxed text-[var(--p-text)]">
              <input type="checkbox" checked={editMed.courseCritical}
                onChange={(e) => setEditMed({ ...editMed, courseCritical: e.target.checked })}
                className="mt-0.5 h-4 w-4 accent-[var(--p-rose)]" />
              <span>
                <b>Full course required</b> — antibiotic, TB or antimalarial drug. The dispense scratchpad
                will warn loudly if anyone tries to give a patient fewer days than the doctor prescribed.
              </span>
            </label>
            <p className="mx-6 mb-4 rounded-lg bg-[var(--p-amber-soft)] px-3 py-2 text-[11px] leading-relaxed text-[#8a6414]">
              <strong>Medicines ARE taxable</strong> — usually 5%, some at 12%. Unlike lab tests, which are exempt. Confirm rates with your CA.
            </p>
            <div className="flex justify-end gap-3 border-t border-[var(--p-border)] p-5">
              <button onClick={() => setEditMed(null)} className="rounded-lg border border-[var(--p-border)] px-4 py-2 text-sm text-[var(--p-text)]">Cancel</button>
              <PrimaryButton onClick={saveMed} disabled={busy || !editMed.name}>{busy ? <><Spinner /> Saving…</> : <><Icon name="check" size={15} /> Save</>}</PrimaryButton>
            </div>
          </div>
        </div>
      )}
    </PortalScroll>
  );
}

/* Craft layer. Density and precision over spectacle — this screen is used with a
   patient waiting, so every effect here is either informational or under 200ms. */
const CSS = `
.num { font-family: var(--font-mono); font-variant-numeric: tabular-nums; letter-spacing: -0.01em; }
.lbl { display:block; margin-bottom:3px; font-size:9px; font-weight:700; letter-spacing:.09em;
  text-transform:uppercase; color:var(--p-muted); }

.stk-hit { grid-template-columns: minmax(0,1fr) auto; }
@media (min-width: 1080px) { .stk-hit { grid-template-columns: minmax(0,1fr) auto auto auto auto; } }
.stk-hit { transition: background-color .16s ease, box-shadow .16s ease; }
.stk-hit:hover { background: var(--p-bg); }
.stk-hit.is-open { background: var(--p-bg); box-shadow: inset 3px 0 0 var(--p-blue); }

.stk-row { animation: stkIn .34s cubic-bezier(.22,.68,.28,1) both; animation-delay: var(--d, 0ms); }
@keyframes stkIn { from { opacity:0; transform: translateY(5px); } to { opacity:1; transform:none; } }
@media (prefers-reduced-motion: reduce) { .stk-row { animation: none; } }

/* the rack tag reads like the physical shelf label it maps to */
.bin { position:relative; display:inline-flex; align-items:center; justify-content:center;
  min-width:54px; padding:5px 10px 5px 13px; border-radius:6px;
  font-family:var(--font-mono); font-size:13px; font-weight:700; letter-spacing:.09em;
  color:var(--p-ink); background:linear-gradient(180deg,#fff,var(--p-bg));
  border:1px solid var(--p-border-strong);
  box-shadow: inset 0 1px 0 #fff, 0 1px 2px rgba(9,26,52,.06); }
.bin::before { content:""; position:absolute; left:0; top:22%; bottom:22%; width:3px;
  border-radius:0 3px 3px 0; background:var(--p-blue); }
.bin-lg { min-width:62px; padding:8px 12px 8px 15px; font-size:15px; }
.bin-empty { color:var(--p-muted); background:var(--p-bg); box-shadow:none; }
.bin-empty::before { background:var(--p-border-strong); }

.meter { height:4px; width:100%; max-width:108px; border-radius:999px;
  background:var(--p-border); overflow:hidden; }
.meter > i { display:block; height:100%; border-radius:999px; transition:width .45s cubic-bezier(.22,.68,.28,1); }

.exp { display:inline-block; border-radius:6px; padding:3px 8px; font-size:12px; font-weight:700; letter-spacing:-.01em; }
.exp-ok   { color:var(--p-ink);   background:var(--p-bg); font-family:var(--font-mono); font-variant-numeric:tabular-nums; }
.exp-warn { color:#8a6414;        background:var(--p-amber-soft); }
.exp-bad  { color:var(--p-rose);  background:var(--p-rose-soft); }
.exp-none { color:var(--p-muted); background:var(--p-bg); }

.seg { display:inline-flex; align-items:center; gap:7px; border-radius:9px; border:1px solid var(--p-border);
  background:#fff; padding:8px 12px; font-size:13px; font-weight:600; color:var(--p-text);
  transition: border-color .15s ease, background-color .15s ease, color .15s ease, transform .12s ease; }
.seg:hover { border-color:var(--p-blue); transform: translateY(-1px); }
.seg-n { border-radius:5px; background:var(--p-bg); padding:1px 6px; font-size:11px; font-weight:700; color:var(--p-muted); }
.seg-on { border-color:var(--p-blue); background:var(--p-blue); color:#fff; box-shadow:0 4px 14px var(--p-blue-glow); }
.seg-on .seg-n { background:rgba(255,255,255,.22); color:#fff; }
.seg-warn .seg-n { background:var(--p-amber-soft); color:#8a6414; }
.seg-bad  .seg-n { background:var(--p-rose-soft);  color:var(--p-rose); }

.pull-strip { display:flex; width:100%; align-items:center; gap:8px; padding:8px 20px; text-align:left;
  border-top:1px solid rgba(224,67,92,.2); background:var(--p-rose-soft);
  font-size:12px; color:var(--p-rose); transition:background-color .15s ease; }
.pull-strip:hover { background:rgba(224,67,92,.16); }

.batch { display:flex; flex-wrap:wrap; align-items:center; gap:6px 18px; position:relative;
  border-radius:9px; border:1px solid var(--p-border); background:#fff; padding:10px 14px; }
.batch-dead { border-color:rgba(224,67,92,.3); background:var(--p-rose-soft); }
.fefo { position:absolute; top:-7px; left:12px; border-radius:4px; background:var(--p-cyan);
  padding:1px 6px; font-size:9px; font-weight:800; letter-spacing:.06em; text-transform:uppercase; color:#fff; }
.dead-tag { border-radius:4px; background:var(--p-rose); padding:2px 7px; font-size:9px; font-weight:800;
  letter-spacing:.06em; text-transform:uppercase; color:#fff; }

.kbd { border-radius:5px; border:1px solid var(--p-border); background:var(--p-bg); padding:1px 6px;
  font-family:var(--font-mono); font-size:11px; color:var(--p-muted); }

.modal-veil { position:fixed; inset:0; z-index:50; display:flex; align-items:center; justify-content:center;
  padding:16px; background:rgba(9,26,52,.42); backdrop-filter:blur(3px);
  animation: veilIn .16s ease both; }
@keyframes veilIn { from { opacity:0 } to { opacity:1 } }
.modal-veil > * { animation: sheetIn .22s cubic-bezier(.22,.68,.28,1) both; }
@keyframes sheetIn { from { opacity:0; transform: translateY(10px) scale(.985) } to { opacity:1; transform:none } }
@media (prefers-reduced-motion: reduce) { .modal-veil, .modal-veil > * { animation:none } }

/* the rack glyph — a small drawn shelf, not a bar chart. Boxes read ok/low/dead
   at a glance; the frame is just structure, so it stays neutral. */
.shelf { display:inline-flex; flex-shrink:0; align-items:center; gap:8px; }
.shelf svg { width:44px; height:41px; flex-shrink:0; overflow:visible; }
.shelf__label { font-family:var(--font-mono); font-size:11px; font-weight:700; letter-spacing:.04em; color:var(--p-muted); }
.sh-frame { fill:var(--p-border-strong); }
.sh-ok    { fill:var(--p-cyan); }
.sh-low   { fill:var(--p-amber); }
.sh-dead  { fill:var(--p-rose); }
.sh-slash { stroke:var(--p-border-strong); stroke-width:2; stroke-linecap:round; }
`;


/**
 * A rack, drawn as a rack.
 *
 * "A2" in a coloured square tells a pharmacist nothing. A shelf with boxes on it
 * tells them how full it is before they read a single word — and a red box tells
 * them something on that shelf is expired and needs pulling TODAY. The board
 * should read like the room it describes.
 */
function ShelfGlyph({
  label, filled, lowCount, deadCount, unassigned,
}: {
  label: string; filled: number; lowCount: number; deadCount: number; unassigned: boolean;
}) {
  // three shelves, up to 4 boxes each — the shape of the shelf, not a bar chart
  const SLOTS = 12;
  const boxes = Math.min(filled, SLOTS);
  const dead = Math.min(deadCount, boxes);
  const low = Math.min(lowCount, Math.max(0, boxes - dead));

  return (
    <span className="shelf" title={unassigned ? "No rack assigned" : `Rack ${label}`}>
      <svg viewBox="0 0 56 52" role="img" aria-label={unassigned ? "Unassigned" : `Rack ${label}, ${filled} medicines`}>
        {/* uprights */}
        <rect className="sh-frame" x="2" y="2" width="3" height="48" rx="1.5" />
        <rect className="sh-frame" x="51" y="2" width="3" height="48" rx="1.5" />
        {/* three shelf boards */}
        {[16, 32, 48].map((y) => (
          <rect key={y} className="sh-frame" x="2" y={y} width="52" height="2.5" rx="1.25" />
        ))}
        {/* the boxes on them */}
        {Array.from({ length: boxes }).map((_, i) => {
          const row = Math.floor(i / 4);      // 0,1,2 top to bottom
          const col = i % 4;
          const x = 7 + col * 11;
          const y = 6 + row * 16;
          const tone = i < dead ? "sh-dead" : i < dead + low ? "sh-low" : "sh-ok";
          return <rect key={i} className={tone} x={x} y={y} width="9" height="10" rx="1.5" />;
        })}
        {unassigned && <line className="sh-slash" x1="8" y1="8" x2="48" y2="44" />}
      </svg>
      <span className="shelf__label">{label}</span>
    </span>
  );
}