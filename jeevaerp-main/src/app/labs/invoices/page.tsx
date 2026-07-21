"use client";

import { useEffect, useState } from "react";
import { Pill, statusTone, PrimaryButton } from "@/components/portal/ui/primitives";
import { Icon } from "@/components/portal/ui/icons";
import { Spinner } from "@/components/portal/ui/form-atoms";
import { DiscountInput } from "@/components/portal/ui/bill-fields";
import { PortalScroll } from "@/components/portal/portal-scroll";
import { api, ApiClientError } from "@/lib/api-client";

interface Row {
  id: string; receiptNo: string; source: string; status: string;
  totalAmount: string; amountPaid: string; createdAt: string;
  patient: { displayId: string; fullName: string };
}
interface Full {
  id: string; receiptNo: string; status: string;
  items: { description: string; qty: number; unitPrice: string; amount: string; gstRatePct: string; hsnSac: string | null }[];
  discountAmount: string; totalAmount: string; amountPaid: string;
}

export default function InvoicesPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editing, setEditing] = useState<Full | null>(null);
  const [cancelling, setCancelling] = useState<Row | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    try { const { invoices } = await api.get<{ invoices: Row[] }>("/billing/invoices?source=LAB"); setRows(invoices); }
    catch (e) { setError(e instanceof ApiClientError ? e.message : "Couldn't load invoices."); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function openEdit(r: Row) {
    setError(null);
    try {
      const { invoice } = await api.get<{ invoice: Full }>(`/billing/invoice/${r.id}`);
      setEditing(invoice);
    } catch (e) { setError(e instanceof ApiClientError ? e.message : "Couldn't open the invoice."); }
  }

  async function saveEdit() {
    if (!editing) return;
    setBusy(true); setError(null);
    try {
      await api.patch(`/billing/invoice/${editing.id}`, {
        lines: editing.items.map((i) => ({
          description: i.description, qty: i.qty, unitPrice: Number(i.unitPrice),
          gstRatePct: Number(i.gstRatePct), hsnSac: i.hsnSac ?? undefined,
        })),
        discountAmount: Number(editing.discountAmount) || undefined,
      });
      setEditing(null); await load();
    } catch (e) { setError(e instanceof ApiClientError ? e.message : "Could not save."); }
    finally { setBusy(false); }
  }

  async function doCancel() {
    if (!cancelling) return;
    setBusy(true); setError(null);
    try {
      await api.post(`/billing/invoice/${cancelling.id}/cancel`, { reason });
      setCancelling(null); setReason(""); await load();
    } catch (e) { setError(e instanceof ApiClientError ? e.message : "Could not cancel."); }
    finally { setBusy(false); }
  }

  const fld = "w-full rounded-lg border border-[var(--p-border)] bg-white px-3 py-2 text-sm text-[var(--p-ink)] outline-none focus:border-[var(--p-teal)]";
  const editable = (s: string) => s === "PENDING";

  return (
    <PortalScroll>
      <div data-rise className="surface dotgrid mb-6 px-6 py-5">
        <h1 className="font-serif-p text-[22px] font-semibold text-[var(--p-ink)]">Lab invoices</h1>
        <p className="mt-1 text-[13px] leading-relaxed text-[var(--p-muted)]">
          Unpaid invoices can be edited. Once paid, an invoice can only be <strong>cancelled and reissued</strong> — a tax invoice is a legal record and is never silently rewritten.
        </p>
      </div>

      {error && (
        <div data-rise className="mb-4 flex items-start gap-2 rounded-lg border border-[var(--p-rose)]/25 bg-[var(--p-rose-soft)] px-4 py-3 text-[13px] text-[var(--p-rose)]">
          <Icon name="alert" size={15} /> <span>{error}</span>
        </div>
      )}

      <section data-rise className="surface overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-20 text-[13px] text-[var(--p-muted)]"><Spinner /> Loading invoices…</div>
        ) : rows.length === 0 ? (
          <p className="py-20 text-center text-[13px] text-[var(--p-muted)]">No lab invoices yet.</p>
        ) : (
          <div className="divide-y divide-[var(--p-border)]">
            {rows.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 transition-colors hover:bg-[var(--p-bg)]">
                <div>
                  <div className="font-mono text-[13px] font-semibold text-[var(--p-ink)]">{r.receiptNo}</div>
                  <div className="text-[12px] text-[var(--p-muted)]">
                    {r.patient.fullName} · <span className="tabular">{r.patient.displayId}</span> · {new Date(r.createdAt).toLocaleDateString("en-IN")}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="font-mono text-[13px] font-semibold text-[var(--p-ink)]">₹{r.totalAmount}</span>
                  <Pill tone={statusTone(r.status === "PAID" ? "Completed" : r.status === "CANCELLED" ? "Cancelled" : "Waiting")}>{r.status}</Pill>
                  <a href={`/print/invoice/${r.id}`} target="_blank" rel="noopener noreferrer" title="View & print the bill"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--p-border)] px-3 py-1.5 text-[12px] font-medium text-[var(--p-teal)] hover:border-[var(--p-teal)]">
                    <Icon name="printer" size={13} /> Bill
                  </a>

                  {r.status !== "CANCELLED" && (
                    <>
                      {editable(r.status) ? (
                        <button onClick={() => openEdit(r)} className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--p-border)] px-3 py-1.5 text-[12px] font-medium text-[var(--p-teal)] hover:border-[var(--p-teal)]">
                          <Icon name="file" size={13} /> Edit
                        </button>
                      ) : (
                        <span className="badge !text-[10px] text-[var(--p-muted)]">paid · locked</span>
                      )}
                      <button onClick={() => { setCancelling(r); setReason(""); }} className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--p-rose)]/30 px-3 py-1.5 text-[12px] font-medium text-[var(--p-rose)] hover:bg-[var(--p-rose-soft)]">
                        Cancel
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* EDIT modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="surface w-full max-w-2xl bg-white">
            <div className="flex items-center justify-between border-b border-[var(--p-border)] px-6 py-4">
              <h3 className="text-[14px] font-semibold text-[var(--p-ink)]">Edit {editing.receiptNo}</h3>
              <button onClick={() => setEditing(null)} className="text-[var(--p-muted)] hover:text-[var(--p-ink)]">✕</button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto overscroll-contain p-6">
              <div className="space-y-3">
                {editing.items.map((it, idx) => (
                  <div key={idx} className="grid grid-cols-[1fr_70px_90px_80px] items-center gap-2">
                    <input className={fld} value={it.description}
                      onChange={(e) => setEditing({ ...editing, items: editing.items.map((x, i) => i === idx ? { ...x, description: e.target.value } : x) })} />
                    <input className={fld} value={it.qty} inputMode="numeric"
                      onChange={(e) => setEditing({ ...editing, items: editing.items.map((x, i) => i === idx ? { ...x, qty: Number(e.target.value.replace(/\D/g, "")) || 1 } : x) })} />
                    <input className={fld} value={it.unitPrice} inputMode="decimal"
                      onChange={(e) => setEditing({ ...editing, items: editing.items.map((x, i) => i === idx ? { ...x, unitPrice: e.target.value.replace(/[^\d.]/g, "") } : x) })} />
                    <button onClick={() => setEditing({ ...editing, items: editing.items.filter((_, i) => i !== idx) })}
                      className="rounded-lg border border-[var(--p-rose)]/30 py-2 text-[12px] text-[var(--p-rose)] hover:bg-[var(--p-rose-soft)]" disabled={editing.items.length === 1}>
                      Remove
                    </button>
                  </div>
                ))}
              </div>
              <button onClick={() => setEditing({ ...editing, items: [...editing.items, { description: "", qty: 1, unitPrice: "0", amount: "0", gstRatePct: "0", hsnSac: null }] })}
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-[var(--p-border)] px-3 py-2 text-[12px] font-medium text-[var(--p-teal)] hover:border-[var(--p-teal)]">
                <Icon name="plus" size={13} /> Add line
              </button>
              <div className="mt-5 max-w-[220px]">
                <DiscountInput
                  subtotal={editing.items.reduce((sum, i) => sum + Number(i.unitPrice || 0) * (i.qty || 1), 0)}
                  accent="teal"
                  initialAmount={Number(editing.discountAmount) || 0}
                  onChange={(d) => setEditing((prev) => (prev ? { ...prev, discountAmount: String(d.amount) } : prev))}
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 border-t border-[var(--p-border)] p-5">
              <button onClick={() => setEditing(null)} className="rounded-lg border border-[var(--p-border)] px-4 py-2 text-sm text-[var(--p-text)]">Cancel</button>
              <PrimaryButton onClick={saveEdit} disabled={busy}>{busy ? <><Spinner /> Saving…</> : <><Icon name="check" size={15} /> Save changes</>}</PrimaryButton>
            </div>
          </div>
        </div>
      )}

      {/* CANCEL modal */}
      {cancelling && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="surface w-full max-w-md bg-white">
            <div className="border-b border-[var(--p-border)] px-6 py-4">
              <h3 className="text-[14px] font-semibold text-[var(--p-ink)]">Cancel {cancelling.receiptNo}?</h3>
            </div>
            <div className="p-6">
              <p className="text-[13px] leading-relaxed text-[var(--p-muted)]">
                The invoice stays in the ledger permanently, marked CANCELLED. Any lab tests on it are released so you can bill them again on a corrected invoice.
              </p>
              <label className="mb-1.5 mt-4 block text-[11px] font-semibold uppercase tracking-wide text-[var(--p-muted)]">Reason (required)</label>
              <input className={fld} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Wrong test billed" autoFocus />
            </div>
            <div className="flex justify-end gap-3 border-t border-[var(--p-border)] p-5">
              <button onClick={() => setCancelling(null)} className="rounded-lg border border-[var(--p-border)] px-4 py-2 text-sm text-[var(--p-text)]">Keep it</button>
              <button onClick={doCancel} disabled={busy || reason.trim().length < 3}
                className="inline-flex items-center gap-2 rounded-lg bg-[var(--p-rose)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
                {busy ? <><Spinner /> Cancelling…</> : "Cancel invoice"}
              </button>
            </div>
          </div>
        </div>
      )}
    </PortalScroll>
  );
}
