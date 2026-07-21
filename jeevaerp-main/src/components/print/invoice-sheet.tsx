"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import JsBarcode from "jsbarcode";
import QRCode from "qrcode";
import { api, ApiClientError } from "@/lib/api-client";
import { amountInWords } from "@/lib/amount-words";
import {
  PRINT_CSS, PrintToolbar, LetterHead, FooterBand, type HospitalInfo,
} from "@/components/print/stationery";

interface Invoice {
  id: string; receiptNo: string; source: string; status: string; createdAt: string;
  patient: { displayId: string; fullName: string; phone: string; address: string | null; age: number | null; gender: string | null };
  items: { description: string; hsnSac: string | null; qty: number; unitPrice: string; amount: string; gstRatePct: string }[];
  subtotal: string; discountAmount: string; taxableAmount: string;
  cgstAmount: string; sgstAmount: string; totalAmount: string; amountPaid: string; balanceDue: string;
  payments: { mode: string; amount: string; reference: string | null; createdAt: string }[];
  hospital: HospitalInfo | null;
}

const SOURCE_LABEL: Record<string, string> = {
  CONSULTATION: "OP Consultation", LAB: "Laboratory", PHARMACY: "Pharmacy", IPD: "Inpatient / Bed charges", OTHER: "Services",
};
const money = (v: string | number) => `₹${Number(v).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const GENDER: Record<string, string> = { MALE: "M", FEMALE: "F", OTHER: "O" };

/** The Jeeva bill — one Bill-of-Supply layout used by every portal, with a
 *  QR code (scan to verify) and a Code128 barcode of the receipt number. */
export function InvoiceSheet() {
  const { invoiceId } = useParams<{ invoiceId: string }>();
  const [inv, setInv] = useState<Invoice | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [qr, setQr] = useState<string>("");
  const barcodeRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    api.get<{ invoice: Invoice }>(`/billing/invoice/${invoiceId}`)
      .then((r) => setInv(r.invoice))
      .catch((e) => setError(e instanceof ApiClientError ? e.message : "Couldn't load the bill."));
  }, [invoiceId]);

  useEffect(() => {
    if (!inv) return;
    QRCode.toDataURL(`https://www.jeevamultispecialityhospital.com/verify/${inv.receiptNo}`, { margin: 0, width: 200, errorCorrectionLevel: "M" })
      .then(setQr).catch(() => setQr(""));
    if (barcodeRef.current) {
      try {
        JsBarcode(barcodeRef.current, inv.receiptNo, { format: "CODE128", displayValue: false, height: 30, width: 1.35, margin: 0, background: "transparent", lineColor: "#17211e" });
      } catch { /* non-encodable receipt — barcode simply omitted */ }
    }
  }, [inv]);

  if (error) return <div className="p-10 text-center text-[14px] text-[#8a3b2e]">{error}</div>;
  if (!inv) return <div className="p-10 text-center text-[14px] text-[#5a6a66]">Preparing the bill…</div>;

  const created = new Date(inv.createdAt);
  const gstApplies = Number(inv.cgstAmount) > 0 || Number(inv.sgstAmount) > 0;
  const discPctNum = Number(inv.subtotal) > 0 ? (Number(inv.discountAmount) / Number(inv.subtotal)) * 100 : 0;
  const discPct = discPctNum % 1 === 0 ? discPctNum.toFixed(0) : discPctNum.toFixed(1);
  const ageSex = [inv.patient.age != null ? `${inv.patient.age}y` : null, inv.patient.gender ? GENDER[inv.patient.gender] ?? inv.patient.gender : null].filter(Boolean).join(" / ") || "—";
  const payMode = inv.payments.length ? inv.payments.map((p) => p.mode).join(", ") : "—";

  const Meta = ({ k, v }: { k: string; v: string }) => (
    <div className="flex items-baseline gap-1.5">
      <span className="shrink-0 whitespace-nowrap text-[8.5px] font-bold uppercase tracking-wide text-[#57655f]">{k}</span>
      <span className="truncate font-mono text-[11px] font-medium text-[var(--pr-ink)]">{v}</span>
    </div>
  );

  return (
    <div className="print-stage">
      <style dangerouslySetInnerHTML={{ __html: PRINT_CSS }} />
      <PrintToolbar title={`Bill · ${inv.receiptNo} · ${inv.patient.fullName}`} />

      <div id="print-sheet">
        <LetterHead hospital={inv.hospital} />

        {/* title + QR row */}
        <div className="rule-strong mt-1 flex items-start justify-between gap-4 pb-2">
          <div>
            <p className="text-[15px] font-extrabold uppercase tracking-[0.06em]" style={{ color: "var(--pr-primary)" }}>
              {gstApplies ? "Tax Invoice" : "Bill of Supply"}
              <span className="ml-1 text-[11px] font-semibold text-[#57655f]">(Original)</span>
            </p>
            <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#57655f]">
              {SOURCE_LABEL[inv.source] ?? inv.source}
              {inv.hospital?.gstin && <> · GSTIN {inv.hospital.gstin}</>}
            </p>
          </div>
          {qr && (
            <div className="flex flex-col items-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qr} alt="Scan to verify" className="h-[64px] w-[64px]" />
              <span className="mt-0.5 text-[7px] uppercase tracking-wide text-[#8b9691]">Scan to verify</span>
            </div>
          )}
        </div>

        {/* bill meta + barcode */}
        <div className="mt-2 grid grid-cols-[1fr_auto] items-start gap-4">
          <div className="grid grid-cols-2 gap-x-6 gap-y-1">
            <Meta k="Bill No" v={inv.receiptNo} />
            <Meta k="UHID" v={inv.patient.displayId} />
            <Meta k="Bill Date" v={created.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })} />
            <Meta k="Time" v={created.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })} />
          </div>
          <div className="flex flex-col items-end">
            <svg ref={barcodeRef} className="h-[30px] w-[150px]" aria-label={`Barcode ${inv.receiptNo}`} />
            <span className="font-mono text-[8px] tracking-[0.14em] text-[#57655f]">{inv.receiptNo}</span>
          </div>
        </div>

        {/* patient / payor block */}
        <div className="rule mt-2 grid grid-cols-[2fr_1fr] gap-x-6 py-4 mb-10">
          <div className="space-y-1">
            <Meta k="Patient" v={inv.patient.fullName} />
            <Meta k="Address" v={inv.patient.address || "—"} />
          </div>
          <div className="space-y-1 ">
            <Meta k="Age/Sex" v={ageSex} />
            <Meta k="Phone" v={inv.patient.phone} />
            <Meta k="Payor" v={inv.payments.length ? "Self" : "—"} />
          </div>
        </div>

        {/* line items */}
        <table className="mt-3 w-full border-collapse text-[12px]">
          <thead>
            <tr className="text-left text-[9px] uppercase tracking-wide" style={{ color: "var(--pr-primary)" }}>
              <th className="w-[26px] border-y-2 py-1.5 pr-1 font-bold" style={{ borderColor: "var(--pr-primary)" }}>S.No</th>
              <th className="border-y-2 py-1.5 pr-2 font-bold" style={{ borderColor: "var(--pr-primary)" }}>Service / Item</th>
              <th className="w-[64px] border-y-2 py-1.5 pr-2 font-bold" style={{ borderColor: "var(--pr-primary)" }}>HSN/SAC</th>
              <th className="w-[36px] border-y-2 py-1.5 pr-2 text-right font-bold" style={{ borderColor: "var(--pr-primary)" }}>Qty</th>
              <th className="w-[76px] border-y-2 py-1.5 pr-2 text-right font-bold" style={{ borderColor: "var(--pr-primary)" }}>Price</th>
              <th className="w-[46px] border-y-2 py-1.5 pr-2 text-right font-bold" style={{ borderColor: "var(--pr-primary)" }}>GST%</th>
              <th className="w-[92px] border-y-2 py-1.5 text-right font-bold" style={{ borderColor: "var(--pr-primary)" }}>Amount (₹)</th>
            </tr>
          </thead>
          <tbody>
            {inv.items.map((it, i) => (
              <tr key={i} className="align-top">
                <td className="rule py-[6px] pr-1 font-mono text-[11px] text-[#57655f]">{i + 1}</td>
                <td className="rule py-[6px] pr-2">{it.description}</td>
                <td className="rule py-[6px] pr-2 font-mono text-[11px]">{it.hsnSac ?? "—"}</td>
                <td className="rule py-[6px] pr-2 text-right font-mono">{it.qty}</td>
                <td className="rule py-[6px] pr-2 text-right font-mono">{money(it.unitPrice)}</td>
                <td className="rule py-[6px] pr-2 text-right font-mono">{Number(it.gstRatePct) ? `${it.gstRatePct}%` : "Exempt"}</td>
                <td className="rule py-[6px] text-right font-mono">{money(it.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* totals + words */}
        <div className="mt-3 flex items-start justify-between gap-6">
          <div className="min-w-0 flex-1">
            <p className="text-[9px] font-bold uppercase tracking-wide text-[#3c4a45]">Received with thanks the sum of</p>
            <p className="mt-0.5 text-[13px] font-black italic" style={{ color: "var(--pr-primary)" }}>{amountInWords(inv.amountPaid)}</p>
            <p className="mt-2 text-[11px] text-[#4a5652]">
              <span className="font-semibold">Paid by:</span> {payMode}
              {inv.payments.some((p) => p.reference) && ` · Ref ${inv.payments.filter((p) => p.reference).map((p) => p.reference).join(", ")}`}
            </p>
            <p className="mt-2 text-[8.5px] leading-relaxed text-[#6b7772]">
              Healthcare services (consultation &amp; diagnostics) are GST-exempt; lines marked Exempt carry 0%.
              Medicines and taxable services show CGST + SGST split equally (intra-state, Telangana – 36).
              This is a computer-generated bill and needs no signature.
            </p>
          </div>
          <table className="w-[248px] text-[12px]">
            <tbody>
              <Trow k="Total Amount" v={money(inv.subtotal)} />
              {Number(inv.discountAmount) > 0 && <Trow k={`Discount (${discPct}%)`} v={`− ${money(inv.discountAmount)}`} />}
              {gstApplies && <Trow k="Taxable value" v={money(inv.taxableAmount)} />}
              {gstApplies && <Trow k="CGST" v={money(inv.cgstAmount)} />}
              {gstApplies && <Trow k="SGST" v={money(inv.sgstAmount)} />}
              <tr>
                <td className="border-y-2 py-1.5 text-[11px] font-extrabold uppercase tracking-wide" style={{ borderColor: "var(--pr-primary)", color: "var(--pr-primary)" }}>Net Payable</td>
                <td className="border-y-2 py-1.5 text-right font-mono text-[14px] font-bold" style={{ borderColor: "var(--pr-primary)" }}>{money(inv.totalAmount)}</td>
              </tr>
              <Trow k="Paid Amount" v={money(inv.amountPaid)} />
              {Number(inv.balanceDue) > 0 && <Trow k="Balance Due" v={money(inv.balanceDue)} strong />}
            </tbody>
          </table>
        </div>

        {/* signature */}
        <div className="mb-3 mt-8 flex items-end justify-between">
          <div>
            <div className="w-[150px] border-b border-[var(--pr-ink)]" />
            <div className="mt-1 text-[10px] font-semibold">{inv.patient.fullName}</div>
            <div className="text-[8px] text-[#57655f]">Patient / Attendant</div>
          </div>
          <div className="text-center">
            <div className="mx-auto w-[170px] border-b border-[var(--pr-ink)]" />
            <div className="mt-1 text-[10px] font-semibold">For {inv.hospital?.legalName ?? "Jeeva Multispeciality Hospital"}</div>
            <div className="text-[8px] text-[#57655f]">Authorised Signatory</div>
          </div>
        </div>

        <p className="text-[8px] text-[#6b7772]">
          Printed on {new Date().toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}.
          You can access your reports &amp; bills at the patient portal with your UHID.
        </p>

        <FooterBand hospital={inv.hospital} />
      </div>
    </div>
  );
}

function Trow({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <tr>
      <td className={`py-1 text-[11px] ${strong ? "font-bold text-[var(--pr-primary)]" : "text-[#4a5652]"}`}>{k}</td>
      <td className={`py-1 text-right font-mono ${strong ? "font-bold" : ""}`}>{v}</td>
    </tr>
  );
}
