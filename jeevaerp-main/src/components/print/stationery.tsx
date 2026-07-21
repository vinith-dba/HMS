"use client";

import { useState } from "react";

/**
 * Jeeva print stationery — one visual family for every paper the desk hands out.
 *
 * The geometry mirrors the referral sheet the client's world already uses
 * (doctor block left · hospital block right · patient strip · vitals strip ·
 * ruled clinical lines · Rx table with dosage + Telugu timing hints · solid
 * footer band), re-branded for Jeeva. Colours come from two CSS variables so
 * the whole stationery can be re-inked in one place if the client wants the
 * classic red/blue instead of teal/saffron.
 *
 * Print strategy: these pages render inside the portal shell, so @media print
 * hides everything except #print-sheet. A4 portrait, 10mm margins.
 */

export interface HospitalInfo {
  legalName: string; addressLine: string; city: string; state: string;
  stateCode: string; pincode: string; gstin: string | null; phone: string | null;
}

export const PRINT_CSS = `
  .print-stage { --pr-primary: #0b5f55; --pr-accent: #c77d33; --pr-ink: #17211e; --pr-line: #b9c4c0; }
  .print-stage { background: #e8e6e1; min-height: 100vh; padding: 24px 12px 64px; }
  #print-sheet { width: 210mm; min-height: 296mm; margin: 0 auto; background: #fff; color: var(--pr-ink);
    box-shadow: 0 8px 40px rgba(0,0,0,.18); padding: 10mm 11mm 0; display: flex; flex-direction: column;
    font-family: var(--font-sans, "Instrument Sans"), "Noto Sans Telugu", "Nirmala UI", Arial, sans-serif; font-size: 11.5px; line-height: 1.45; }
  #print-sheet .rule { border-bottom: 1px solid var(--pr-line); }
  #print-sheet .rule-strong { border-bottom: 2px solid var(--pr-primary); }
  @media print {
    body * { visibility: hidden !important; }
    #print-sheet, #print-sheet * { visibility: visible !important; }
    #print-sheet { position: absolute; inset: 0 auto auto 0; width: 100%; min-height: 0; margin: 0; box-shadow: none; padding: 0; }
    .print-stage { background: #fff; padding: 0; }
    @page { size: A4 portrait; margin: 10mm; }
  }
`;

/** Screen-only toolbar; vanishes in print. */
export function PrintToolbar({ title }: { title: string }) {
  return (
    <div className="mx-auto mb-4 flex w-full max-w-[210mm] items-center justify-between print:hidden">
      <p className="text-[13px] font-medium text-[#5a6a66]">{title}</p>
      <div className="flex gap-2">
        <button onClick={() => history.back()}
          className="rounded-lg border border-[#c8ccc9] bg-white px-4 py-2 text-[13px] font-medium text-[#3a4744] hover:border-[#0b5f55] hover:text-[#0b5f55]">
          ← Back
        </button>
        <button onClick={() => window.print()}
          className="rounded-lg bg-[#0b5f55] px-5 py-2 text-[13px] font-semibold text-white hover:bg-[#084a42]">
          Print / Save PDF
        </button>
      </div>
    </div>
  );
}

/**
 * Letterhead — the actual photographed hospital stationery (logo, wordmark,
 * phone, address, closing rule all baked into one image at
 * /public/images/jeeva-header.jpg), bled edge-to-edge like the FooterBand.
 * This is real ink from the real letterhead, not a redrawn approximation —
 * so it prints correctly even if Hospital settings are ever out of sync.
 *
 * The consulting doctor, when given, prints as a slim line under the image
 * — the photo itself is one generic header used for every doctor, so their
 * name is the one thing added per-sheet, not per-press-run.
 *
 * If the image is ever missing (fresh checkout, asset not deployed yet) this
 * falls back to a hand-coded reconstruction from Hospital settings, so the
 * sheet still prints something usable instead of a broken image icon.
 */
export function LetterHead({ hospital, doctor }: {
  hospital: HospitalInfo | null;
  doctor?: { name: string; specialization: string; department: string } | null;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const name = (hospital?.legalName ?? "Jeeva Multi Speciality Hospital").toUpperCase();
  const addressLine = hospital
    ? `${hospital.addressLine}, ${hospital.city}, ${hospital.state} – ${hospital.pincode}.`
    : "# 1-8-81, Sai Nagar, Beside Swimming Pool, Balasamudram, Hanamkonda, Telangana – 506 001.";
  const phone = hospital?.phone ?? "9704691308";

  if (imgFailed) {
    return (
      <div className="rule-strong pb-2">
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/jeeva-logo.png" alt={name} className="h-[44px] w-[44px] shrink-0 object-contain" />
            <div className="min-w-0 text-[22px] font-extrabold uppercase leading-[1.05] tracking-tight" style={{ color: "#c8211b" }}>
              {name}
            </div>
          </div>
          <div className="shrink-0 whitespace-nowrap text-[11px] font-semibold text-[#1f2937]">Cell : {phone}</div>
        </div>
        <div className="mt-1 text-center text-[10.5px] font-medium leading-snug text-[#1f2937]">{addressLine}</div>
        {doctor && (
          <div className="mt-1 text-center text-[10px] font-semibold" style={{ color: "var(--pr-primary)" }}>
            Dr. {doctor.name} · {doctor.specialization} · Department of {doctor.department}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="rule-strong w-full  flex items-end justify-between  h-full  pb-2">
      {doctor && (
        <div className="mt-1 text-start text-[10px] font-semibold" style={{ color: "var(--pr-primary)" }}>
          <span className="font-bold tracking-tighter text-[25px] flex flex-col leading-[0.8] justify-start text-start "> {doctor.name}</span> <br /> · <span className="font-medium text-[21px] tracking-tighter leading-[0.8]">{doctor.specialization}</span> <br /> · Department of {doctor.department}
        </div>
      )}
      <div className="w-[550px]" style={{ margin: "0 -11mm" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/jeeva-header.jpeg"
          alt={name}
          style={{ width: "100%", display: "block" }}
          onError={() => setImgFailed(true)}
        />
      </div>

    </div>
  );
}

/** The two-row patient strip every document opens with. */
export function PatientStrip({ cells }: {
  cells: { k: string; v: string; grow?: boolean; mono?: boolean; pen?: boolean }[];
}) {
  return (
    <div
      className=" grid items-baseline gap-x-6 gap-y-1 py-0.8 mt-3 text-[13px]"
      style={{ gridTemplateColumns: cells.map((c) => (c.grow ? "minmax(0,2.1fr)" : "minmax(0,1fr)")).join(" ") }}
    >
      {cells.map((c, i) => (
        <div key={i} className="flex min-w-0 items-baseline gap-1.5">
          <span className="shrink-0 whitespace-nowrap font-semibold uppercase tracking-wide text-[9px] text-[#57655f]">{c.k}</span>
          {c.pen ? (
            /* an intentional writing line — a blank pad cell, not missing data */
            <span className="inline-block w-full border-b border-[var(--pr-line)]">&nbsp;</span>
          ) : (
            <span className={`truncate font-medium text-[var(--pr-ink)] ${c.mono ? "font-mono" : ""}`}>{c.v || "—"}</span>
          )}
        </div>
      ))}
    </div>
  );
}

/**
 * A labelled line with the typed value printed over the rule — the
 * computerized twin of RuledLine. Falls back to a blank pen line when
 * nothing was typed, so the sheet reads the same either way.
 */
export function FilledLine({ label, value, trailing }: { label: string; value?: string | null; trailing?: string }) {
  if (!value?.trim()) return <RuledLine label={label} trailing={trailing} />;
  return (
    <div className="py-3">
      <div className="flex items-end gap-2">
        <span className="shrink-0 text-[9.5px] font-bold uppercase tracking-wide text-[#3c4a45]">{label}</span>
        <span className="rule flex-1 pb-0.5 text-[12px] font-semibold leading-snug" style={{ color: "var(--pr-primary)" }}>
          {value}
        </span>
        {trailing && <span className="text-[9px] text-[#6b7772]">{trailing}</span>}
      </div>
    </div>
  );
}

/**
 * Prescribed lab investigations — a numbered list in the sheet's own ink,
 * two columns when the list is long. Advisory text for the patient and the
 * lab counter; actual lab ORDERS are LabTest rows on the visit.
 */
export function LabList({ tests }: { tests: string[] }) {
  if (!tests.length) return null;
  return (
    <div className="py-3">
      <p className="text-[9.5px] font-bold uppercase tracking-wide" style={{ color: "var(--pr-primary)" }}>
        Lab investigations advised
      </p>
      <ol className={`mt-1.5 grid gap-x-8 gap-y-1 text-[12px] ${tests.length > 4 ? "grid-cols-2" : "grid-cols-1"}`}>
        {tests.map((t, i) => (
          <li key={i} className="flex items-baseline gap-2 border-b border-[var(--pr-line)] pb-1">
            <span className="font-mono text-[10px]" style={{ color: "var(--pr-primary)" }}>{i + 1}.</span>
            <span className="font-semibold text-[var(--pr-ink)]">{t}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** A labelled hand-fill line, e.g. "DIAGNOSIS ______________". */
export function RuledLine({ label, lines = 1, trailing }: { label: string; lines?: number; trailing?: string }) {
  return (
    <div className="py-5">
      <div className="flex items-end gap-2">
        <span className="text-[9.5px] font-bold uppercase tracking-wide text-[#3c4a45]">{label}</span>
        <span className="rule mb-0.5 flex-1" />
        {trailing && <span className="text-[9px] text-[#6b7772]">{trailing}</span>}
      </div>
      {Array.from({ length: lines - 1 }).map((_, i) => <div key={i} className="rule h-[28px]" />)}
    </div>
  );
}

/**
 * The ℞ table — medicines as reception typed them while sending to pharmacy.
 * This is the same data, read straight back out: no separate "prescription
 * document" exists anywhere else. Dosage is split on the fly — "1-0-1 after
 * food" becomes the 1-0-1 pattern in its own column and "after food" in
 * Timing & duration — because that's the one typing convention reception
 * already uses in the /prescriptions form.
 *
 * blankRows pads the table out to a fixed row count so a light Rx doesn't
 * leave a half-empty sheet; pass 0 to print exactly the entered rows.
 */
export function RxTable({ items, blankRows = 0, note }: {
  items: { medicineName: string; qty: number; dosage: string | null }[];
  blankRows?: number;
  note?: string;
}) {
  return (
    <div className="mt-2 flex-none">
      <table className="w-full border-collapse text-[12px]">
        <thead>
          <tr className="text-left text-[9.5px] uppercase tracking-wide" style={{ color: "var(--pr-primary)" }}>
            <th className="w-[36px] border-y-2 py-1.5 pr-1 font-bold" style={{ borderColor: "var(--pr-primary)" }}>℞</th>
            <th className="border-y-2 py-1.5 pr-2 font-bold" style={{ borderColor: "var(--pr-primary)" }}>Medicine</th>
            <th className="w-[86px] border-y-2 py-1.5 pr-2 font-bold" style={{ borderColor: "var(--pr-primary)" }}>Dosage<br /><span className="font-medium normal-case text-[#57655f]">ఉ – మ – రా</span></th>
            <th className="w-[190px] border-y-2 py-1.5 font-bold" style={{ borderColor: "var(--pr-primary)" }}>Timing & duration<br /><span className="font-medium normal-case text-[#57655f]">భోజనం ముందు / తర్వాత</span></th>
          </tr>
        </thead>
        <tbody>
          {items.map((it, i) => {
            // "1-0-0 after food 1 month" -> dosage pattern into its column, rest into timing
            const dosage = it.dosage?.trim() ?? "";
            const m = dosage.match(/^([0-9]+(?:\/[0-9]+)?\s*[-–]\s*[0-9]+(?:\/[0-9]+)?\s*[-–]\s*[0-9]+(?:\/[0-9]+)?)\s*(.*)$/);
            const pattern = m ? m[1].replace(/\s/g, "") : "";
            const timing = m ? m[2] : dosage;
            return (
              <tr key={i} className="align-top" style={{ color: "var(--pr-primary)" }} >
                <td className=" py-[7px] pr-1 font-mono text-[11px] text-[#57655f]">{i + 1}.</td>
                <td className=" py-[7px] pr-2 font-bold">{it.medicineName}{it.qty > 1 ? <span className="ml-1 font-normal text-[#57655f]">× {it.qty}</span> : null}</td>
                <td className=" py-[7px] pr-2 font-mono">{pattern || "—"}</td>
                <td className=" py-[7px]">{timing || ""}</td>
              </tr>
            );
          })}
          {Array.from({ length: blankRows }).map((_, i) => (
            <tr key={`b${i}`}>
              <td className=" py-[13px] pr-1 font-mono text-[11px] text-[#8b9691]">{items.length + i + 1}.</td>
              <td className="" /><td className="" /><td className="" />
            </tr>
          ))}
        </tbody>
      </table>
      {items.length > 0 && note && <p className="mt-1 text-[8.5px] text-[#6b7772]">{note}</p>}
    </div>
  );
}

/** Solid footer band — appointments · address · timings. Pinned to sheet bottom. */
export function FooterBand({ hospital }: { hospital: HospitalInfo | null }) {
  return (
    <div className="mt-auto">
      <div style={{ background: "var(--pr-accent)", height: 3 }} />
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-0.5 px-4 py-2 text-[10px] font-medium text-white"
        style={{ background: "var(--pr-primary)", margin: "0 -11mm" }}>
        <span>For Appointments: <span className="font-bold">{hospital?.phone ?? "—"}</span></span>
        <span>{hospital ? `${hospital.addressLine}, ${hospital.city} – ${hospital.pincode}` : ""}</span>
        <span>OPD 8:00 AM – 8:00 PM · Emergency 24×7</span>
      </div>
    </div>
  );
}