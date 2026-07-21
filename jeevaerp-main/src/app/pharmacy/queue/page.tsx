"use client";

import { useCallback, useEffect, useState } from "react";
import { PrimaryButton, Pill } from "@/components/portal/ui/primitives";
import { Icon } from "@/components/portal/ui/icons";
import { Spinner } from "@/components/portal/ui/form-atoms";
import { PortalScroll } from "@/components/portal/portal-scroll";
import { api, ApiClientError } from "@/lib/api-client";
import { DispenseScratchpad, perDayFromDosage, type PadLine } from "@/components/portal/pharmacy/scratchpad";
import { DiscountInput, PaymentSection, type Tender } from "@/components/portal/ui/bill-fields";

interface RxTypedItem { medicineName: string; medicineId: string | null; qty: number; dosage: string | null; }
interface Rx {
  id: string; fileUrl: string | null; fileName: string | null; mimeType: string | null; title: string | null; doctorName: string | null;
  status: string; sentToPharmacyAt: string | null; dispensedAt: string | null;
  patient: { id: string; displayId: string; fullName: string; phone: string; age: number | null };
  items: RxTypedItem[];
}
interface Med { id: string; name: string; unit: string; gstRatePct: string; inStock: number; mrp: string | null; nearestExpiry: string | null; lowStock: boolean; courseCritical: boolean; }
type Line = PadLine;


export default function RxQueuePage() {
  const [tab, setTab] = useState<"SENT_TO_PHARMACY" | "DISPENSED">("SENT_TO_PHARMACY");
  const [queue, setQueue] = useState<Rx[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // dispensing panel
  const [active, setActive] = useState<Rx | null>(null);
  const [meds, setMeds] = useState<Med[]>([]);
  const [search, setSearch] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [shortReason, setShortReason] = useState("");
  const [disc, setDisc] = useState(0);
  const [payNow, setPayNow] = useState(true);
  const [payments, setPayments] = useState<Tender[]>([]);
  const [payValid, setPayValid] = useState(true);
  const [busy, setBusy] = useState(false);
  // An admitted patient's medicines are charged to their room, so there is no
  // receipt at the counter. Both outcomes must be renderable.
  const [done, setDone] = useState<{ id: string; receiptNo: string; total: string } | null>(null);
  const [toRoom, setToRoom] = useState<{ ipNumber: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { const { queue } = await api.get<{ queue: Rx[] }>(`/pharmacy/queue?status=${tab}`); setQueue(queue); }
    catch (e) { setError(e instanceof ApiClientError ? e.message : "Couldn't load the queue."); }
    finally { setLoading(false); }
  }, [tab]);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!active) return;
    api.get<{ medicines: Med[] }>(`/pharmacy/medicines${search ? `?q=${encodeURIComponent(search)}` : ""}`)
      .then((r) => setMeds(r.medicines)).catch(() => setMeds([]));
  }, [active, search]);

  // Reception already typed the medicines from the handwriting — pre-fill the
  // bill with every line that matched the catalog. Two clicks instead of ten.
  useEffect(() => {
    if (!active) return;
    const matched = active.items.filter((it) => it.medicineId);
    if (!matched.length) { setLines([]); return; }
    api.get<{ medicines: Med[] }>("/pharmacy/medicines").then(({ medicines }) => {
      const byId = new Map(medicines.map((m) => [m.id, m]));
      setLines(
        matched.flatMap((it) => {
          const m = byId.get(it.medicineId as string);
          if (!m || m.inStock === 0) return [];
          const prescribedQty = Math.max(1, it.qty);
          return [{
            medicineId: m.id, name: m.name, unit: m.unit,
            qty: Math.min(prescribedQty, m.inStock),
            mrp: Number(m.mrp ?? 0), gst: Number(m.gstRatePct), inStock: m.inStock,
            prescribedQty,                              // what the doctor actually wrote
            perDay: perDayFromDosage(it.dosage),        // "1-0-1" -> 2 a day
            courseCritical: m.courseCritical,
            locked: m.courseCritical,                   // antibiotics start protected
          }];
        })
      );
    }).catch(() => setLines([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.id]);

  function addLine(m: Med) {
    if (m.inStock === 0) return;
    setLines((p) => p.some((l) => l.medicineId === m.id)
      ? p.map((l) => l.medicineId === m.id ? { ...l, qty: Math.min(l.qty + 1, m.inStock) } : l)
      : [...p, { medicineId: m.id, name: m.name, unit: m.unit, qty: 1, mrp: Number(m.mrp ?? 0), gst: Number(m.gstRatePct), inStock: m.inStock, prescribedQty: 0, perDay: 0, courseCritical: m.courseCritical, locked: m.courseCritical }]);
  }
  const setQty = (id: string, q: number) => setLines((p) => p.map((l) => l.medicineId === id ? { ...l, qty: Math.max(1, Math.min(q, l.inStock)) } : l));
  const removeLine = (id: string) => setLines((p) => p.filter((l) => l.medicineId !== id));

  const subtotal = lines.reduce((s, l) => s + l.qty * l.mrp, 0);
  const gst = lines.reduce((s, l) => {
    const after = l.qty * l.mrp * (subtotal > 0 ? 1 - disc / subtotal : 1);
    return s + (after * l.gst) / 100;
  }, 0);
  const total = subtotal - disc + gst;

  // Short supply = giving less than the doctor prescribed. Two consequences:
  // a reason is required, and if an ANTIBIOTIC is the thing being cut, we refuse
  // to let it through on a shrug — that's a resistance risk, not a discount.
  const shortLines = lines.filter((l) => l.prescribedQty > 0 && l.qty < l.prescribedQty);
  const isShort = shortLines.length > 0;
  const abxShort = shortLines.some((l) => l.courseCritical);
  const blockedReason = isShort && shortReason.trim().length < 3;

  async function submit() {
    if (!active || !lines.length) return;
    setBusy(true); setError(null);
    try {
      const res = await api.post<{ chargedToRoom: boolean; ipNumber: string | null; invoice: { id: string; receiptNo: string; totalAmount: string } | null }>("/pharmacy/dispense", {
        patientId: active.patient.id,
        prescriptionUploadId: active.id,
        items: lines.map((l) => ({ medicineId: l.medicineId, qty: l.qty })),
        discountAmount: disc || undefined,
        shortSupplyReason: isShort ? shortReason.trim() || undefined : undefined,
        payments: payNow && payments.length ? payments : undefined,
      });
      if (res.chargedToRoom) setToRoom({ ipNumber: res.ipNumber ?? "" });
      else if (res.invoice) setDone({ id: res.invoice.id, receiptNo: res.invoice.receiptNo, total: res.invoice.totalAmount });
      setLines([]); setDisc(0); setPayments([]); setPayValid(true);
      await load();
    } catch (e) { setError(e instanceof ApiClientError ? e.message : "Could not dispense."); }
    finally { setBusy(false); }
  }

  function close() { setActive(null); setLines([]); setDisc(0); setPayments([]); setPayValid(true); setShortReason(""); setDone(null); setToRoom(null); setSearch(""); setError(null); }


  return (
    <PortalScroll>
      <div data-rise className="surface dotgrid mb-6 flex flex-wrap items-center justify-between gap-4 px-6 py-5">
        <div>
          <h1 className="font-serif-p text-[22px] font-semibold text-[var(--p-ink)]">Prescription queue</h1>
          <p className="mt-1 text-[13px] text-[var(--p-muted)]">The doctor&apos;s handwritten scan, sent through by reception. Open it, read it, dispense.</p>
        </div>
        <div className="flex gap-1 rounded-lg border border-[var(--p-border)] bg-white p-1">
          {([["SENT_TO_PHARMACY", "Waiting"], ["DISPENSED", "Dispensed"]] as const).map(([v, l]) => (
            <button key={v} onClick={() => setTab(v)}
              className={`rounded-lg px-3.5 py-1.5 text-[12px] font-semibold transition-colors ${tab === v ? "bg-[var(--p-blue)] text-white" : "text-[var(--p-muted)] hover:text-[var(--p-ink)]"}`}>{l}</button>
          ))}
        </div>
      </div>

      {error && !active && <div data-rise className="mb-4 rounded-lg border border-[var(--p-rose)]/25 bg-[var(--p-rose-soft)] px-4 py-3 text-[13px] text-[var(--p-rose)]">{error}</div>}

      <section data-rise className="surface overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-[13px] text-[var(--p-muted)]"><Spinner /> Loading…</div>
        ) : queue.length === 0 ? (
          <p className="py-16 text-center text-[13px] text-[var(--p-muted)]">
            {tab === "SENT_TO_PHARMACY" ? "Nothing waiting. Reception hasn't sent any prescriptions through." : "Nothing dispensed yet."}
          </p>
        ) : (
          <div className="divide-y divide-[var(--p-border)]">
            {queue.map((r) => (
              <div key={r.id} className="flex flex-wrap items-start justify-between gap-3 px-6 py-4 transition-colors hover:bg-[var(--p-bg)]">
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--p-cyan-soft)] text-[var(--p-cyan-deep)]"><Icon name="file" size={18} /></span>
                  <div className="min-w-0">
                    <div className="truncate text-[14px] font-medium text-[var(--p-ink)]">{r.patient.fullName}</div>
                    <div className="truncate text-[12px] text-[var(--p-muted)]">
                      <span className="tabular">{r.patient.displayId}</span> · {r.patient.phone}
                      {r.doctorName && ` · ${r.doctorName}`}
                    </div>
                    {r.items.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {r.items.slice(0, 5).map((it, i) => (
                          <span key={i} className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${it.medicineId ? "border-[var(--p-cyan)]/40 bg-[var(--p-cyan-soft)] text-[var(--p-cyan-deep)]" : "border-[var(--p-border)] text-[var(--p-muted)]"}`}>
                            {it.medicineName} ×{it.qty}
                          </span>
                        ))}
                        {r.items.length > 5 && <span className="text-[10px] text-[var(--p-muted)]">+{r.items.length - 5} more</span>}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2 pt-1">
                  <Pill tone={r.status === "DISPENSED" ? "completed" : "waiting"}>{r.status === "DISPENSED" ? "Dispensed" : "Waiting"}</Pill>
                  {r.fileUrl && (
                    <a href={r.fileUrl} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--p-border)] px-3 py-1.5 text-[13px] font-medium text-[var(--p-blue)] hover:border-[var(--p-blue)]">
                      <Icon name="file" size={13} /> View scan
                    </a>
                  )}
                  {r.status !== "DISPENSED" && (
                    <button onClick={() => setActive(r)}
                      className="btn-primary inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[14px] font-semibold text-white">
                      <Icon name="pill" size={13} /> Dispense
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* DISPENSE panel — scan on the left to read, bill on the right to build.
          Height discipline: every zone owns its scroll; money + the dispense
          button are pinned and can never be pushed out of view. */}
      {active && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-5">
          <div className="surface flex h-[98vh] w-full max-w-[1480px] flex-col overflow-hidden bg-white">
            <div className="flex items-center justify-between border-b border-[var(--p-border)] px-6 py-4">
              <div className="min-w-0">
                <h3 className="truncate text-[15px] font-semibold text-[var(--p-ink)]">{active.patient.fullName}</h3>
                <p className="truncate text-[12px] text-[var(--p-muted)]">
                  <span className="tabular">{active.patient.displayId}</span>
                  {active.doctorName && ` · ${active.doctorName}`}
                </p>
              </div>
              <button onClick={close} className="shrink-0 text-[var(--p-muted)] hover:text-[var(--p-ink)]">✕</button>
            </div>

            {toRoom ? (
              <div className="flex flex-col items-center px-6 py-14 text-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--p-blue-soft)] text-[var(--p-blue-deep)]"><Icon name="bed" size={26} /></span>
                <h3 className="mt-4 font-serif-p text-[22px] font-semibold text-[var(--p-ink)]">Charged to the room</h3>
                <p className="mt-1 text-[13px] text-[var(--p-muted)]">
                  This patient is admitted — <span className="font-mono font-semibold text-[var(--p-ink)]">{toRoom.ipNumber}</span>
                </p>
                <p className="mt-3 max-w-sm rounded-lg bg-[var(--p-amber-soft)] px-4 py-2.5 text-[12px] leading-relaxed text-[#8a6414]">
                  <b>Do not take money.</b> The medicines are on their room tab and will be settled in the discharge bill.
                  No receipt is printed here.
                </p>
                <p className="mt-2 text-[12px] text-[var(--p-muted)]">Stock decremented FEFO. The prescription is marked dispensed.</p>
                <div className="mt-5"><PrimaryButton onClick={close}>Done</PrimaryButton></div>
              </div>
            ) : done ? (
              <div className="flex flex-col items-center px-6 py-14 text-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--p-cyan-soft)] text-[var(--p-cyan-deep)]"><Icon name="check" size={26} /></span>
                <h3 className="mt-4 font-serif-p text-[22px] font-semibold text-[var(--p-ink)]">Dispensed</h3>
                <p className="mt-1 text-[13px] text-[var(--p-muted)]">
                  Receipt <span className="font-mono font-semibold text-[var(--p-ink)]">{done.receiptNo}</span> · ₹{done.total}
                </p>
                <p className="mt-1 text-[12px] text-[var(--p-muted)]">Stock decremented FEFO. The prescription is marked dispensed.</p>
                <div className="mt-5 flex items-center gap-2">
                  <a href={`/print/invoice/${done.id}`} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-md border border-[var(--p-border)] px-4 py-2.5 text-[13px] font-semibold text-[var(--p-blue)] transition-colors hover:border-[var(--p-blue)]">
                    <Icon name="printer" size={15} /> View &amp; print bill
                  </a>
                  <PrimaryButton onClick={close}>Done</PrimaryButton>
                </div>
              </div>
            ) : (
              <>
                <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto md:grid-cols-[2fr_3fr] md:overflow-hidden">
                  {/* ---- LEFT: the doctor's prescription, to read ---- */}
                  <div className="flex flex-col border-b border-[var(--p-border)] bg-[var(--p-bg)] md:min-h-0 md:border-b-0 md:border-r">
                    <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--p-border)] px-5 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--p-muted)]">Doctor&apos;s prescription</p>
                      {active.fileUrl && (
                        <a href={active.fileUrl} target="_blank" rel="noopener noreferrer"
                          className="shrink-0 text-[12px] font-medium text-[var(--p-blue)] hover:underline">
                          Open full size ↗
                        </a>
                      )}
                    </div>
                    <div className="p-4 md:min-h-0 md:flex-1 md:overflow-y-auto md:overscroll-contain">
                      {active.fileUrl ? (
                        active.mimeType === "application/pdf" || /\.pdf($|\?)/i.test(active.fileUrl) ? (
                          <iframe src={active.fileUrl} title="Prescription sheet"
                            className="h-[58vh] w-full rounded-lg border border-[var(--p-border)] bg-white md:h-[62vh]" />
                        ) : (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img src={active.fileUrl} alt="Scanned prescription" className="w-full rounded-lg border border-[var(--p-border)] bg-white" />
                        )
                      ) : (
                        <div className="rounded-lg border border-dashed border-[var(--p-border-strong)] px-4 py-8 text-center text-[12px] text-[var(--p-muted)]">
                          No scan attached — this one was typed straight in. The bill on the right is pre-filled from it.
                        </div>
                      )}

                      {active.items.length > 0 && (
                        <div className="mt-4 rounded-lg border border-[var(--p-border)] bg-white p-3">
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--p-muted)]">
                            As typed by reception · {active.items.filter((it) => it.medicineId).length}/{active.items.length} matched to the catalog
                          </p>
                          <div className="mt-2 space-y-1.5">
                            {active.items.map((it, i) => (
                              <div key={i} className="flex items-center gap-2 text-[12px]">
                                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${it.medicineId ? "bg-[var(--p-cyan)]" : "bg-[var(--p-amber)]"}`} />
                                <span className="rx-name min-w-0 flex-1 truncate text-[var(--p-ink)]">{it.medicineName}</span>
                                <span className="shrink-0 text-[var(--p-muted)]">× {it.qty}{it.dosage ? ` · ${it.dosage}` : ""}</span>
                                {!it.medicineId && <span className="shrink-0 rounded bg-[var(--p-amber-soft)] px-1.5 py-0.5 text-[9.5px] font-semibold text-[#8a5a1a]">match by search →</span>}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* ---- RIGHT: build the bill ---- */}
                  <div className="flex flex-col md:min-h-0">
                    {/* search — results only appear while typing, so they never bury the bill */}
                    <div className="shrink-0 border-b border-[var(--p-border)] p-3">
                      <div className="flex items-center gap-2 rounded-lg border border-[var(--p-border)] px-3 py-2">
                        <Icon name="search" size={15} />
                        <input value={search} onChange={(e) => setSearch(e.target.value)}
                          placeholder="Search the catalog to add a medicine…" className="w-full text-sm outline-none" autoFocus />
                        {search && (
                          <button onClick={() => setSearch("")} aria-label="Clear search"
                            className="shrink-0 text-[var(--p-muted)] hover:text-[var(--p-ink)]">✕</button>
                        )}
                      </div>
                    </div>
                    {search.trim() && (
                      <div className="max-h-56 shrink-0 overflow-y-auto overscroll-contain border-b border-[var(--p-border)] bg-[var(--p-bg)]/60">
                        {meds.length === 0 ? (
                          <p className="px-4 py-4 text-center text-[12px] text-[var(--p-muted)]">Nothing in the catalog matches &ldquo;{search}&rdquo;.</p>
                        ) : meds.map((m) => {
                          const inBill = lines.some((l) => l.medicineId === m.id);
                          return (
                            <button key={m.id} onClick={() => addLine(m)} disabled={m.inStock === 0}
                              className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left transition-colors hover:bg-white disabled:opacity-40">
                              <div className="min-w-0">
                                <div className="rx-name truncate text-[13px] font-medium text-[var(--p-ink)]">{m.name}</div>
                                <div className="truncate text-[11px] text-[var(--p-muted)]">
                                  {m.inStock === 0 ? "Out of stock" : `${m.inStock} in stock`}
                                  {m.nearestExpiry && ` · exp ${m.nearestExpiry}`} · GST {m.gstRatePct}%
                                </div>
                              </div>
                              <span className="flex shrink-0 items-center gap-2">
                                {inBill && <span className="rounded-full bg-[var(--p-cyan-soft)] px-2 py-0.5 text-[10px] font-semibold text-[var(--p-cyan-deep)]">✓ in bill — tap for +1</span>}
                                <span className="font-mono text-[12px] text-[var(--p-ink)]">{m.mrp ? `₹${m.mrp}` : "—"}</span>
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* the working area: bill lines, scratchpad, money — one scroll */}
                    <div className="space-y-4 p-4 md:min-h-0 md:flex-1 md:overflow-y-auto md:overscroll-contain">
                      <div>
                        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--p-muted)]">
                          Bill · {lines.length} {lines.length === 1 ? "medicine" : "medicines"}
                        </p>
                        {lines.length === 0 ? (
                          <p className="rounded-lg border border-dashed border-[var(--p-border-strong)] px-4 py-8 text-center text-[12px] text-[var(--p-muted)]">
                            Nothing pre-matched — read the scan on the left, then search above to add each medicine.
                          </p>
                        ) : (
                          <div className="space-y-2">
                            {lines.map((l) => (
                              <div key={l.medicineId} className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-[var(--p-border)] p-3">
                                <div className="min-w-0 flex-1 basis-40">
                                  <div className="flex items-center gap-1.5">
                                    {l.courseCritical && (
                                      <span title="Course-critical (antibiotic) — don't cut this one short" className="shrink-0 text-[var(--p-rose)]"><Icon name="alert" size={12} /></span>
                                    )}
                                    <span className="rx-name truncate text-[13px] font-medium text-[var(--p-ink)]">{l.name}</span>
                                  </div>
                                  <div className="mt-0.5 text-[10.5px] text-[var(--p-muted)]">
                                    ₹{l.mrp} · GST {l.gst}%
                                    {l.prescribedQty > 0 && <> · prescribed ×{l.prescribedQty}</>}
                                    {" · "}{l.inStock} in stock
                                  </div>
                                </div>
                                <div className="flex shrink-0 items-center gap-1">
                                  <button onClick={() => setQty(l.medicineId, l.qty - 1)} disabled={l.qty <= 1} aria-label="One less"
                                    className="grid h-7 w-7 place-items-center rounded-md border border-[var(--p-border)] text-[14px] font-bold text-[var(--p-ink)] hover:border-[var(--p-blue)] disabled:opacity-30">−</button>
                                  <input type="number" min={1} max={l.inStock} value={l.qty}
                                    onChange={(e) => setQty(l.medicineId, Number(e.target.value))}
                                    className="w-12 shrink-0 rounded-md border border-[var(--p-border)] px-1 py-1 text-center text-[12px] outline-none focus:border-[var(--p-blue)]" />
                                  <button onClick={() => setQty(l.medicineId, l.qty + 1)} disabled={l.qty >= l.inStock} aria-label="One more"
                                    className="grid h-7 w-7 place-items-center rounded-md border border-[var(--p-border)] text-[14px] font-bold text-[var(--p-ink)] hover:border-[var(--p-blue)] disabled:opacity-30">+</button>
                                </div>
                                <span className="w-16 shrink-0 text-right font-mono text-[12.5px] font-semibold text-[var(--p-ink)]">₹{(l.qty * l.mrp).toFixed(0)}</span>
                                <button onClick={() => removeLine(l.medicineId)} aria-label={`Remove ${l.name}`}
                                  className="shrink-0 text-[var(--p-rose)] hover:opacity-70">✕</button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {lines.length > 0 && (
                        <DispenseScratchpad
                          lines={lines}
                          discount={disc}
                          onChange={setLines}
                          reason={shortReason}
                          onReasonChange={setShortReason}
                        />
                      )}

                      <div className="rounded-xl border border-[var(--p-border)] p-3.5">
                        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--p-muted)]">Money</p>
                        <div className="mb-2">
                          <DiscountInput subtotal={subtotal} accent="blue" onChange={(d) => setDisc(d.amount)} />
                        </div>
                        <label className="mb-2 flex items-center gap-2 text-[12px] text-[var(--p-text)]">
                          <input type="checkbox" checked={payNow} onChange={(e) => setPayNow(e.target.checked)} className="h-4 w-4 accent-[var(--p-blue)]" /> Pay now
                        </label>
                        {payNow && (
                          <PaymentSection total={total} accent="blue" onChange={(r) => { setPayments(r.payments); setPayValid(r.valid); }} />
                        )}
                      </div>
                    </div>

                    {/* pinned money strip — always visible, whatever scrolls above */}
                    <div className="flex shrink-0 flex-wrap items-center justify-end gap-x-6 gap-y-1 border-t border-[var(--p-border)] bg-[var(--p-bg)] px-4 py-2.5 text-[12px]">
                      <span className="text-[var(--p-muted)]">Subtotal <span className="font-mono text-[var(--p-ink)]">₹{subtotal.toFixed(2)}</span></span>
                      {disc > 0 && <span className="text-[var(--p-muted)]">Discount <span className="font-mono text-[var(--p-ink)]">−₹{disc.toFixed(2)}</span></span>}
                      <span className="text-[var(--p-muted)]">GST <span className="font-mono text-[var(--p-ink)]">₹{gst.toFixed(2)}</span></span>
                      <span className="font-semibold text-[var(--p-ink)]">Total <span className="font-mono text-[15px] font-bold text-[var(--p-blue)]">₹{total.toFixed(2)}</span></span>
                    </div>
                  </div>
                </div>

                {error && <div className="shrink-0 border-t border-[var(--p-border)] bg-[var(--p-rose-soft)] px-6 py-2.5 text-[12px] text-[var(--p-rose)]">{error}</div>}

                <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-[var(--p-border)] p-4">
                  <p className="text-[11px] text-[var(--p-muted)]">
                    {blockedReason
                      ? <span className="font-semibold text-[var(--p-rose)]">Say why the patient is taking less before you dispense.</span>
                      : abxShort
                        ? <span className="font-semibold text-[var(--p-rose)]">An antibiotic course is being cut short — reconsider.</span>
                        : "Batches are picked automatically by earliest expiry (FEFO)."}
                  </p>
                  <PrimaryButton onClick={submit} disabled={busy || lines.length === 0 || blockedReason || (payNow && !payValid)}>
                    {busy ? <><Spinner /> Dispensing…</> : <><Icon name="pill" size={15} /> Dispense &amp; bill ₹{total.toFixed(2)}</>}
                  </PrimaryButton>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </PortalScroll>
  );
}