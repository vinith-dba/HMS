"use client";

import { useMemo, useRef, useState } from "react";
import { Icon } from "@/components/portal/ui/icons";
import { Spinner } from "@/components/portal/ui/form-atoms";
import { api, ApiClientError } from "@/lib/api-client";

interface MedRef { id: string; name: string; genericName?: string | null }
interface Row { medicine: string; batchNo: string; expiry: string; qty: string; mrp: string; rate: string; supplier: string; createNew?: boolean; hsn?: string; gst?: string }
interface ImportResult { row: number; medicine: string; batchNo: string; ok: boolean; error?: string; created?: boolean }
interface ImportReport { created: number; createdMedicines: number; results: ImportResult[] }

const blankRow = (): Row => ({ medicine: "", batchNo: "", expiry: "", qty: "", mrp: "", rate: "", supplier: "" });
const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const isoLocal = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Turn whatever a supplier wrote (a Date cell, DD/MM/YYYY, or MM/YYYY) into
 *  YYYY-MM-DD. Bare month/year → the last day of that month (pharma convention). */
function toISODate(v: unknown): string {
  if (v instanceof Date && !Number.isNaN(v.getTime())) return isoLocal(v);
  const s = String(v ?? "").trim();
  if (!s) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  let m;
  if ((m = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/))) {
    const d = m[1], mo = m[2], y = m[3].length === 2 ? "20" + m[3] : m[3];
    return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  if ((m = s.match(/^(\d{1,2})[/\-.](\d{2,4})$/))) {
    const mo = Number(m[1]), y = Number(m[2].length === 2 ? "20" + m[2] : m[2]);
    const last = new Date(y, mo, 0).getDate();
    return `${y}-${String(mo).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? "" : isoLocal(d);
}

const HEADER_TEMPLATE = "Medicine,Batch No,Expiry (YYYY-MM-DD or MM/YYYY),Quantity,MRP,Purchase Rate,Supplier Ref\nParacetamol 500mg,B1234,2027-06-30,100,18.50,12.00,INV-2024-001\n";

/**
 * Pull batch lines out of an OCR'd distributor invoice. Indian pharma invoices
 * run  NO · HSN · DESCRIPTION · PACK · QTY · BATCH · MRP · EXPDT · RATE · GST …
 * The expiry (MM/YY) is the one unmistakable anchor on each line, so we find it
 * and read the neighbours: MRP and BATCH sit just left of it, RATE just right.
 * Description length varies, so anchoring beats a fixed regex.
 */
function parseInvoiceText(text: string): Row[] {
  const rows: Row[] = [];
  const cleanNum = (s: string) => (s || "").replace(/[^\d.]/g, "");
  for (const rawLine of text.split("\n")) {
    const line = rawLine.replace(/\s+/g, " ").trim();
    if (line.length < 8) continue;
    const t = line.split(" ");
    let ei = -1;
    for (let i = 3; i < t.length; i++) {
      const m = t[i].match(/^(\d{1,2})\/(\d{2,4})$/);
      if (m && +m[1] >= 1 && +m[1] <= 12) { ei = i; break; }
    }
    if (ei < 3) continue;
    const expiry = toISODate(t[ei]);
    const mrp = cleanNum(t[ei - 1]);
    const batch = (t[ei - 2] || "").replace(/[^A-Za-z0-9/]/g, "");
    const rate = cleanNum(t[ei + 1] ?? "");
    if (!expiry || !mrp || batch.length < 2) continue;
    let qty = "", qi = -1;
    for (let j = ei - 3; j >= 2; j--) { if (/^\d{1,4}$/.test(t[j])) { qty = t[j]; qi = j; break; } }
    const desc = t.slice(2, qi > 2 ? qi : ei - 3).join(" ").replace(/[^A-Za-z0-9 .\-/]/g, "").trim();
    const hsn = /^\d{3,8}$/.test(t[1] || "") ? t[1] : "";       // HSN sits in column 2
    const gstRaw = cleanNum(t[ei + 2] ?? "");                    // GST% follows the rate
    const gst = gstRaw && Number(gstRaw) <= 28 ? String(Number(gstRaw)) : "";
    rows.push({ medicine: desc, batchNo: batch, expiry, qty: qty || "1", mrp, rate, supplier: "", hsn, gst });
  }
  return rows;
}

export function BatchImport({ meds, onClose, onDone }: {
  meds: MedRef[];
  onClose: () => void;
  onDone: (created: number) => void;
}) {
  const [tab, setTab] = useState<"SHEET" | "SCAN">("SHEET");
  const [rows, setRows] = useState<Row[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [scanUrl, setScanUrl] = useState<string | null>(null);
  const [scanFile, setScanFile] = useState<File | null>(null);
  const [scanPdf, setScanPdf] = useState(false);
  const [ocrBusy, setOcrBusy] = useState(false);
  const [ocrPct, setOcrPct] = useState(0);
  const [parsing, setParsing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<ImportReport | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const resolve = useMemo(() => {
    const map = new Map<string, MedRef>();
    for (const m of meds) {
      map.set(m.name.trim().toLowerCase(), m);
      if (m.genericName) map.set(m.genericName.trim().toLowerCase(), m);
    }
    return (name: string) => map.get(name.trim().toLowerCase()) ?? null;
  }, [meds]);

  const today = todayISO();
  const cellOk = (r: Row) => {
    const matched = !!resolve(r.medicine);
    return {
      matched,
      med: matched || (!!r.createNew && r.medicine.trim().length > 1),
      batch: r.batchNo.trim().length > 0,
      expiry: /^\d{4}-\d{2}-\d{2}$/.test(r.expiry) && r.expiry >= today,
      qty: /^\d+$/.test(r.qty.trim()) && Number(r.qty) >= 1,
      mrp: r.mrp.trim() !== "" && Number(r.mrp) >= 0 && !Number.isNaN(Number(r.mrp)),
      rate: r.rate.trim() === "" || (Number(r.rate) >= 0 && !Number.isNaN(Number(r.rate))),
    };
  };
  const rowValid = (r: Row) => { const o = cellOk(r); return o.med && o.batch && o.expiry && o.qty && o.mrp && o.rate; };
  const validCount = rows.filter(rowValid).length;
  const unmatchedCount = rows.filter((r) => r.medicine.trim() && !resolve(r.medicine) && !r.createNew).length;
  const newCount = rows.filter((r) => rowValid(r) && !resolve(r.medicine) && r.createNew).length;

  const setCell = (i: number, key: keyof Row, v: string) =>
    setRows((p) => p.map((r, idx) => (idx === i ? { ...r, [key]: v } : r)));
  const toggleNew = (i: number) => setRows((p) => p.map((r, idx) => (idx === i ? { ...r, createNew: !r.createNew } : r)));
  const markAllNew = () => setRows((p) => p.map((r) => (r.medicine.trim() && !resolve(r.medicine) ? { ...r, createNew: true } : r)));
  const removeRow = (i: number) => setRows((p) => p.filter((_, idx) => idx !== i));

  async function onSheet(f: File) {
    setError(null); setParsing(true); setFileName(f.name);
    try {
      const XLSX = await import("xlsx");
      const buf = await f.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array", cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      // raw:true keeps date cells as real Date objects (toISODate handles them)
      // instead of letting the sheet reformat ISO dates into ambiguous m/d/yy text.
      const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "", raw: true });
      const pick = (o: Record<string, unknown>, re: RegExp) => {
        for (const k of Object.keys(o)) if (re.test(k.toLowerCase().replace(/[^a-z0-9]/g, ""))) return o[k];
        return "";
      };
      const mapped: Row[] = json.map((o) => ({
        medicine: String(pick(o, /^(medicine|item|product|drug|brand|name)/) ?? "").trim(),
        batchNo: String(pick(o, /(batch|lot)/) ?? "").trim(),
        expiry: toISODate(pick(o, /(expiry|exp|bestbefore)/)),
        qty: String(pick(o, /(quantity|qty|units|count|stock|nos|pcs)/) ?? "").replace(/[^\d]/g, ""),
        mrp: String(pick(o, /(mrp|retailprice|saleprice)/) ?? "").replace(/[^\d.]/g, ""),
        rate: String(pick(o, /(purchase|rate|cost|buyingprice|ptr)/) ?? "").replace(/[^\d.]/g, ""),
        supplier: String(pick(o, /(supplier|invoice|vendor|billno|ref)/) ?? "").trim(),
      })).filter((r) => r.medicine || r.batchNo);
      if (!mapped.length) setError("Couldn't find any rows. Check the column headers against the template.");
      setRows(mapped.length ? mapped : []);
    } catch {
      setError("Couldn't read that file. Use .xlsx or .csv, matching the template.");
    } finally { setParsing(false); }
  }

  function onScan(f: File) {
    setError(null);
    if (scanUrl) URL.revokeObjectURL(scanUrl);
    setScanUrl(URL.createObjectURL(f));
    setScanFile(f);
    setScanPdf(f.type === "application/pdf" || /\.pdf$/i.test(f.name));
    if (!rows.length) setRows([blankRow(), blankRow(), blankRow()]);
  }

  async function runOcr() {
    if (!scanFile) return;
    setError(null); setOcrBusy(true); setOcrPct(0);
    try {
      const { recognize } = await import("tesseract.js");
      const { data } = await recognize(scanFile, "eng", {
        logger: (m: { status: string; progress: number }) => {
          if (m.status === "recognizing text") setOcrPct(Math.round(m.progress * 100));
        },
      });
      const parsed = parseInvoiceText(data.text);
      if (!parsed.length) setError("Couldn't read any line items — try a sharper, straighter photo, or key the rows in below.");
      else setRows(parsed);
    } catch {
      setError("OCR couldn't run on this file. Key the rows in below instead.");
    } finally { setOcrBusy(false); }
  }

  function downloadTemplate() {
    const blob = new Blob([HEADER_TEMPLATE], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "jeeva-batch-import-template.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  async function submit() {
    const payload = rows.filter(rowValid).map((r) => {
      const matched = resolve(r.medicine);
      const base = {
        batchNo: r.batchNo.trim(),
        expiryDate: r.expiry,
        quantity: Number(r.qty),
        mrp: Number(r.mrp),
        ...(r.rate.trim() ? { purchasePrice: Number(r.rate) } : {}),
        ...(r.supplier.trim() ? { supplierRef: r.supplier.trim() } : {}),
      };
      return matched
        ? { medicineId: matched.id, ...base }
        : { createNew: true, medicine: r.medicine.trim(), ...(r.hsn ? { hsn: r.hsn } : {}), ...(r.gst ? { gstRatePct: Number(r.gst) } : {}), ...base };
    });
    if (!payload.length) return;
    setBusy(true); setError(null);
    try {
      const res = await api.post<ImportReport>("/pharmacy/batches/bulk", { rows: payload });
      setReport(res);
      if (res.created > 0) onDone(res.created);
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Import failed.");
    } finally { setBusy(false); }
  }

  const inp = "w-full rounded-md border border-[var(--p-border)] bg-white px-2 py-1.5 text-[12px] text-[var(--p-ink)] outline-none focus:border-[var(--p-blue)]";
  const bad = "!border-[var(--p-rose)] bg-[var(--p-rose-soft)]";

  return (
    <div className="import-veil" onClick={onClose}>
      <div className="import-sheet flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white" onClick={(e) => e.stopPropagation()}>
        {/* header */}
        <div className="flex items-center justify-between gap-3 border-b border-[var(--p-border)] px-6 py-4">
          <div>
            <h3 className="text-[15px] font-semibold text-[var(--p-ink)]">Import stock batches</h3>
            <p className="mt-0.5 text-[12px] text-[var(--p-muted)]">Upload a spreadsheet, or key in the rows off a scanned invoice.</p>
          </div>
          <button onClick={onClose} className="shrink-0 text-[var(--p-muted)] hover:text-[var(--p-ink)]">✕</button>
        </div>

        {report ? (
          /* ---- result report ---- */
          <div className="flex-1 overflow-y-auto p-6">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-full bg-[var(--p-cyan-soft)] text-[var(--p-cyan-deep)]"><Icon name="check" size={22} /></span>
              <div>
                <p className="text-[16px] font-semibold text-[var(--p-ink)]">{report.created} of {report.results.length} batches received</p>
                <p className="text-[12px] text-[var(--p-muted)]">
                  Stock is updated with a PURCHASE ledger entry for each{report.createdMedicines > 0 ? ` · ${report.createdMedicines} new ${report.createdMedicines === 1 ? "medicine" : "medicines"} added to the catalog` : ""}.
                </p>
              </div>
            </div>
            {report.results.some((r) => !r.ok) && (
              <div className="mt-4 overflow-hidden rounded-xl border border-[var(--p-rose)]/30">
                <p className="bg-[var(--p-rose-soft)] px-4 py-2 text-[12px] font-semibold text-[var(--p-rose)]">
                  {report.results.filter((r) => !r.ok).length} rows didn&apos;t import — fix and try again:
                </p>
                <div className="divide-y divide-[var(--p-border)]">
                  {report.results.filter((r) => !r.ok).map((r) => (
                    <div key={r.row} className="flex items-center justify-between gap-3 px-4 py-2 text-[12px]">
                      <span className="text-[var(--p-ink)]">Row {r.row}: <b>{r.medicine || "—"}</b> · {r.batchNo || "no batch"}</span>
                      <span className="text-[var(--p-rose)]">{r.error}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="mt-6 flex justify-end">
              <button onClick={onClose} className="btn-primary rounded-md px-5 py-2.5 text-sm font-semibold text-white">Done</button>
            </div>
          </div>
        ) : (
          <>
            {/* tabs */}
            <div className="flex gap-1 border-b border-[var(--p-border)] px-4 pt-3">
              {([["SHEET", "Spreadsheet"], ["SCAN", "Scanned invoice"]] as const).map(([v, l]) => (
                <button key={v} onClick={() => setTab(v)}
                  className={`rounded-t-lg px-4 py-2 text-[13px] font-semibold transition-colors ${tab === v ? "bg-[var(--p-blue-soft)] text-[var(--p-blue-deep)]" : "text-[var(--p-muted)] hover:text-[var(--p-ink)]"}`}>
                  {l}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {tab === "SHEET" ? (
                <div className="mb-4 flex flex-wrap items-center gap-3">
                  <label className="btn-primary inline-flex cursor-pointer items-center gap-2 rounded-md px-4 py-2.5 text-[13px] font-semibold text-white">
                    <Icon name="file" size={14} /> {fileName ? "Replace file" : "Choose .xlsx / .csv"}
                    <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="hidden"
                      onChange={(e) => e.target.files?.[0] && onSheet(e.target.files[0])} />
                  </label>
                  <button onClick={downloadTemplate} className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-[var(--p-blue)] hover:underline">
                    <Icon name="file" size={13} /> Download template
                  </button>
                  {parsing && <span className="flex items-center gap-1.5 text-[12px] text-[var(--p-muted)]"><Spinner size={13} /> Reading…</span>}
                  {fileName && !parsing && <span className="text-[12px] text-[var(--p-muted)]">{fileName} · {rows.length} rows</span>}
                </div>
              ) : (
                <div className="mb-4 grid gap-4 lg:grid-cols-2">
                  <div>
                    <label className="btn-primary inline-flex cursor-pointer items-center gap-2 rounded-md px-4 py-2.5 text-[13px] font-semibold text-white">
                      <Icon name="file" size={14} /> {scanUrl ? "Replace scan" : "Upload scanned invoice"}
                      <input type="file" accept="image/*,application/pdf" className="hidden"
                        onChange={(e) => e.target.files?.[0] && onScan(e.target.files[0])} />
                    </label>
                    {scanUrl ? (
                      scanPdf
                        ? <iframe src={scanUrl} title="Invoice" className="mt-3 h-[300px] w-full rounded-lg border border-[var(--p-border)]" />
                        // eslint-disable-next-line @next/next/no-img-element
                        : <img src={scanUrl} alt="Scanned invoice" className="mt-3 max-h-[300px] w-full rounded-lg border border-[var(--p-border)] object-contain" />
                    ) : (
                      <div className="mt-3 flex h-[160px] items-center justify-center rounded-lg border border-dashed border-[var(--p-border-strong)] px-4 text-center text-[12px] text-[var(--p-muted)]">
                        Upload a photo of the supplier&apos;s invoice, then extract the rows automatically.
                      </div>
                    )}
                  </div>
                  <div className="lg:pt-1">
                    {scanUrl && !scanPdf ? (
                      <>
                        <button onClick={runOcr} disabled={ocrBusy}
                          className="btn-primary inline-flex items-center gap-2 rounded-md px-4 py-2.5 text-[13px] font-semibold text-white disabled:opacity-50">
                          {ocrBusy ? <><Spinner size={14} /> Reading invoice… {ocrPct}%</> : <><Icon name="search" size={14} /> Extract rows from invoice</>}
                        </button>
                        <p className="mt-3 text-[12px] leading-relaxed text-[var(--p-muted)]">
                          Reads the batch numbers, expiry, quantity, MRP and rate straight off the scan. It runs on
                          this computer — nothing is uploaded. <b className="text-[var(--p-ink)]">Always check the rows</b> —
                          OCR can misread a digit, and the invoice&apos;s product names won&apos;t match your catalog,
                          so pick the matching medicine for each (red = not matched yet).
                        </p>
                      </>
                    ) : scanPdf ? (
                      <p className="text-[12px] leading-relaxed text-[var(--p-muted)]">
                        OCR works on a <b>photo or image</b> of the invoice. For a PDF, export a page as an image —
                        or key the rows into the grid below.
                      </p>
                    ) : (
                      <p className="text-[12px] leading-relaxed text-[var(--p-muted)]">
                        Upload a clear, straight photo of the invoice and press <b>Extract</b> — the batch lines fill
                        in automatically. You can also type rows by hand below.
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* unmatched-medicine helper — the invoice's product names won't be in
                  the catalog, so let the whole lot be created in one click. */}
              {rows.length > 0 && unmatchedCount > 0 && (
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--p-amber)]/25 bg-[var(--p-amber-soft)] px-3.5 py-2.5">
                  <span className="text-[12px] text-[#8a5a14]">
                    <b>{unmatchedCount}</b> {unmatchedCount === 1 ? "medicine isn't" : "medicines aren't"} in your catalog yet — add them as new products, or pick the matching one per row.
                  </span>
                  <button onClick={markAllNew} className="shrink-0 rounded-md bg-white px-3 py-1.5 text-[12px] font-semibold text-[var(--p-blue)] ring-1 ring-[var(--p-border-strong)] hover:ring-[var(--p-blue)]">
                    Add all as new medicines
                  </button>
                </div>
              )}

              {/* the rows editor — shared by both tabs */}
              {rows.length > 0 && (
                <div className="overflow-x-auto rounded-xl border border-[var(--p-border)]">
                  <table className="w-full min-w-[820px] border-collapse text-[12px]">
                    <thead>
                      <tr className="border-b border-[var(--p-border)] bg-[var(--p-bg)] text-left text-[10.5px] font-semibold uppercase tracking-wide text-[var(--p-muted)]">
                        <th className="px-2 py-2">Medicine</th>
                        <th className="px-2 py-2 w-28">Match</th>
                        <th className="px-2 py-2">Batch</th>
                        <th className="px-2 py-2">Expiry</th>
                        <th className="px-2 py-2 w-16">Qty</th>
                        <th className="px-2 py-2 w-20">MRP</th>
                        <th className="px-2 py-2 w-20">Rate</th>
                        <th className="px-2 py-2 w-8" />
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r, i) => {
                        const ok = cellOk(r);
                        return (
                          <tr key={i} className="border-b border-[var(--p-border)] last:border-0">
                            <td className="px-1.5 py-1.5">
                              <input list="jeeva-med-names" value={r.medicine} onChange={(e) => setCell(i, "medicine", e.target.value)}
                                placeholder="Medicine name" className={`${inp} min-w-[160px] ${r.medicine && !ok.med ? bad : ""}`} />
                            </td>
                            <td className="px-1.5 py-1.5 whitespace-nowrap">
                              {ok.matched ? (
                                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--p-cyan-deep)]"><Icon name="check" size={11} /> in catalog</span>
                              ) : r.createNew ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-[var(--p-violet-soft)] px-2 py-0.5 text-[10.5px] font-semibold text-[var(--p-violet)]">
                                  New <button onClick={() => toggleNew(i)} aria-label="Don't create" className="ml-0.5 hover:opacity-70">✕</button>
                                </span>
                              ) : r.medicine.trim() ? (
                                <button onClick={() => toggleNew(i)} className="rounded-md px-2 py-1 text-[11px] font-semibold text-[var(--p-blue)] ring-1 ring-[var(--p-border-strong)] hover:ring-[var(--p-blue)]">+ add new</button>
                              ) : (
                                <span className="text-[11px] text-[var(--p-muted)]">—</span>
                              )}
                            </td>
                            <td className="px-1.5 py-1.5"><input value={r.batchNo} onChange={(e) => setCell(i, "batchNo", e.target.value)} placeholder="B123" className={`${inp} ${r.batchNo || !ok.batch ? (ok.batch ? "" : bad) : ""}`} /></td>
                            <td className="px-1.5 py-1.5"><input type="date" min={today} value={r.expiry} onChange={(e) => setCell(i, "expiry", e.target.value)} className={`${inp} ${r.expiry && !ok.expiry ? bad : ""}`} /></td>
                            <td className="px-1.5 py-1.5"><input inputMode="numeric" value={r.qty} onChange={(e) => setCell(i, "qty", e.target.value.replace(/[^\d]/g, ""))} placeholder="0" className={`${inp} ${r.qty && !ok.qty ? bad : ""}`} /></td>
                            <td className="px-1.5 py-1.5"><input inputMode="decimal" value={r.mrp} onChange={(e) => setCell(i, "mrp", e.target.value.replace(/[^\d.]/g, ""))} placeholder="0.00" className={`${inp} ${r.mrp && !ok.mrp ? bad : ""}`} /></td>
                            <td className="px-1.5 py-1.5"><input inputMode="decimal" value={r.rate} onChange={(e) => setCell(i, "rate", e.target.value.replace(/[^\d.]/g, ""))} placeholder="—" className={`${inp} ${r.rate && !ok.rate ? bad : ""}`} /></td>
                            <td className="px-1.5 py-1.5 text-center"><button onClick={() => removeRow(i)} aria-label="Remove row" className="text-[var(--p-rose)] hover:opacity-70">✕</button></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <datalist id="jeeva-med-names">{meds.map((m) => <option key={m.id} value={m.name} />)}</datalist>
                </div>
              )}

              {rows.length > 0 && (
                <button onClick={() => setRows((p) => [...p, blankRow()])} className="mt-2 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-[var(--p-blue)] hover:underline">
                  <Icon name="plus" size={13} /> Add a row
                </button>
              )}

              {error && <p className="mt-4 rounded-lg border border-[var(--p-rose)]/25 bg-[var(--p-rose-soft)] px-4 py-2.5 text-[12.5px] text-[var(--p-rose)]">{error}</p>}
            </div>

            {/* footer */}
            <div className="flex items-center justify-between gap-3 border-t border-[var(--p-border)] px-6 py-4">
              <p className="text-[12px] text-[var(--p-muted)]">
                {rows.length === 0 ? "No rows yet." : <><b className="text-[var(--p-ink)]">{validCount}</b> of {rows.length} rows ready{validCount < rows.length ? " · fix the red cells" : ""}</>}
              </p>
              <div className="flex items-center gap-2">
                <button onClick={onClose} className="rounded-md border border-[var(--p-border)] px-4 py-2.5 text-[13px] font-medium text-[var(--p-text)]">Cancel</button>
                <button onClick={submit} disabled={busy || validCount === 0}
                  className="btn-primary inline-flex items-center gap-2 rounded-md px-5 py-2.5 text-[13px] font-semibold text-white disabled:opacity-40">
                  {busy ? <><Spinner size={14} /> Importing…</> : <><Icon name="check" size={15} /> Import {validCount} {validCount === 1 ? "batch" : "batches"}{newCount > 0 ? ` · ${newCount} new` : ""}</>}
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      <style jsx>{`
        .import-veil { position: fixed; inset: 0; z-index: 60; display: flex; align-items: center; justify-content: center; padding: 16px; background: rgba(7, 26, 32, 0.5); backdrop-filter: blur(2px); }
        .import-sheet { box-shadow: 0 30px 70px -20px rgba(7, 26, 32, 0.5); animation: sheetIn 0.22s cubic-bezier(0.22, 0.68, 0.28, 1) both; }
        @keyframes sheetIn { from { opacity: 0; transform: translateY(10px) scale(0.99); } to { opacity: 1; transform: none; } }
        @media (prefers-reduced-motion: reduce) { .import-sheet { animation: none; } }
      `}</style>
    </div>
  );
}
