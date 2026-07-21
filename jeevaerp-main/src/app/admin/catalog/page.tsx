"use client";

import { useEffect, useState } from "react";
import { PrimaryButton } from "@/components/portal/ui/primitives";
import { Icon } from "@/components/portal/ui/icons";
import { Spinner, Field } from "@/components/portal/ui/form-atoms";
import { PortalScroll } from "@/components/portal/portal-scroll";
import { api, ApiClientError } from "@/lib/api-client";

interface Item { id: string; name: string; code: string | null; price: string; gstRatePct: string; active: boolean; }
const blank = { id: "", name: "", code: "", price: "", gstRatePct: "0", active: true };

export default function CatalogPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [edit, setEdit] = useState<typeof blank | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    try { const { catalog } = await api.get<{ catalog: Item[] }>("/admin/catalog"); setItems(catalog); }
    catch (e) { setError(e instanceof ApiClientError ? e.message : "Couldn't load the catalog."); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function save() {
    if (!edit) return;
    setBusy(true); setError(null);
    try {
      await api.post("/admin/catalog", {
        id: edit.id || undefined, name: edit.name, code: edit.code || undefined,
        price: Number(edit.price), gstRatePct: Number(edit.gstRatePct), active: edit.active,
      });
      setEdit(null); await load();
    } catch (e) { setError(e instanceof ApiClientError ? e.message : "Could not save."); }
    finally { setBusy(false); }
  }

  const fld = "w-full rounded-lg border border-[var(--p-border)] bg-white px-3 py-2 text-sm text-[var(--p-ink)] outline-none focus:border-[var(--p-teal)]";

  return (
    <PortalScroll>
      <div data-rise className="surface dotgrid mb-6 flex flex-wrap items-center justify-between gap-4 px-6 py-5">
        <div>
          <h1 className="font-serif-p text-[22px] font-semibold text-[var(--p-ink)]">Lab catalog & GST</h1>
          <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-[var(--p-muted)]">
            <strong>This is where GST rates are set.</strong> Diagnostic services are generally GST-exempt (0%) under Notification 12/2017 — that&apos;s the default. Have your CA confirm which tests, if any, are taxable, then set the rate here. Invoices update automatically (CGST + SGST, each half the rate).
          </p>
        </div>
        <PrimaryButton onClick={() => setEdit({ ...blank })}><Icon name="plus" size={15} /> Add test</PrimaryButton>
      </div>

      {error && <div data-rise className="mb-4 rounded-lg border border-[var(--p-rose)]/25 bg-[var(--p-rose-soft)] px-4 py-3 text-[13px] text-[var(--p-rose)]">{error}</div>}

      <section data-rise className="surface overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-[13px] text-[var(--p-muted)]"><Spinner /> Loading…</div>
        ) : (
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="border-b border-[var(--p-border)] bg-[var(--p-bg)] text-[11px] uppercase tracking-wide text-[var(--p-muted)]">
                <th className="px-6 py-2.5 font-semibold">Test</th>
                <th className="py-2.5 font-semibold">Code</th>
                <th className="py-2.5 text-right font-semibold">Price</th>
                <th className="py-2.5 text-center font-semibold">GST</th>
                <th className="py-2.5 text-center font-semibold">Status</th>
                <th className="px-6 py-2.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--p-border)]">
              {items.map((i) => (
                <tr key={i.id} className={i.active ? "" : "opacity-55"}>
                  <td className="px-6 py-3 font-medium text-[var(--p-ink)]">{i.name}</td>
                  <td className="py-3 font-mono text-[12px] text-[var(--p-muted)]">{i.code ?? "—"}</td>
                  <td className="py-3 text-right font-mono">₹{i.price}</td>
                  <td className="py-3 text-center">
                    {Number(i.gstRatePct) === 0
                      ? <span className="badge !text-[10px] text-[var(--p-teal)]">Exempt</span>
                      : <span className="font-mono text-[12px] font-semibold text-[var(--p-ink)]">{i.gstRatePct}%</span>}
                  </td>
                  <td className="py-3 text-center text-[12px] text-[var(--p-muted)]">{i.active ? "Active" : "Inactive"}</td>
                  <td className="px-6 py-3 text-right">
                    <button onClick={() => setEdit({ id: i.id, name: i.name, code: i.code ?? "", price: i.price, gstRatePct: i.gstRatePct, active: i.active })}
                      className="rounded-lg border border-[var(--p-border)] px-3 py-1.5 text-[12px] font-medium text-[var(--p-teal)] hover:border-[var(--p-teal)]">Edit</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {edit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="surface w-full max-w-md bg-white">
            <div className="border-b border-[var(--p-border)] px-6 py-4"><h3 className="text-[14px] font-semibold text-[var(--p-ink)]">{edit.id ? "Edit test" : "Add test"}</h3></div>
            <div className="space-y-4 p-6">
              <Field label="Test name"><input className={fld} value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} autoFocus /></Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Code / SAC"><input className={fld} value={edit.code} onChange={(e) => setEdit({ ...edit, code: e.target.value })} /></Field>
                <Field label="Price (₹)"><input className={fld} value={edit.price} onChange={(e) => setEdit({ ...edit, price: e.target.value.replace(/[^\d.]/g, "") })} inputMode="decimal" /></Field>
              </div>
              <Field label="GST rate %">
                <input className={fld} value={edit.gstRatePct} onChange={(e) => setEdit({ ...edit, gstRatePct: e.target.value.replace(/[^\d.]/g, "") })} inputMode="decimal" />
              </Field>
              <p className="rounded-lg bg-[var(--p-amber-soft)] px-3 py-2 text-[11px] leading-relaxed text-[#8a6414]">
                <strong>0 = exempt.</strong> Most diagnostic tests are GST-exempt. Only set a rate if your CA confirms this test is taxable.
              </p>
              <label className="flex items-center gap-2 text-[13px] text-[var(--p-text)]">
                <input type="checkbox" checked={edit.active} onChange={(e) => setEdit({ ...edit, active: e.target.checked })} className="h-4 w-4 accent-[var(--p-teal)]" /> Active (orderable)
              </label>
            </div>
            <div className="flex justify-end gap-3 border-t border-[var(--p-border)] p-5">
              <button onClick={() => setEdit(null)} className="rounded-lg border border-[var(--p-border)] px-4 py-2 text-sm text-[var(--p-text)]">Cancel</button>
              <PrimaryButton onClick={save} disabled={busy || !edit.name || !edit.price}>{busy ? <><Spinner /> Saving…</> : <><Icon name="check" size={15} /> Save</>}</PrimaryButton>
            </div>
          </div>
        </div>
      )}
    </PortalScroll>
  );
}
