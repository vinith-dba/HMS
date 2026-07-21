import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb, type RGB } from "pdf-lib";

/**
 * Server-side render of the OPD prescription — the same sheet the browser
 * prints from `stationery.tsx`, drawn as a real vector PDF so it can be
 * *sent* (to the pharmacy queue and to the patient) without anyone having to
 * scan a photo. Text stays crisp and the file is a few KB, not a megapixel
 * screenshot. Brand colours are lifted straight from the stationery
 * (--pr-primary / --pr-accent / --pr-ink / --pr-line) so paper and PDF match.
 */

// ── brand (from stationery.tsx :root) ───────────────────────────────────────
const TEAL: RGB = rgb(0x0b / 255, 0x5f / 255, 0x55 / 255); // #0b5f55
const AMBER: RGB = rgb(0xc7 / 255, 0x7d / 255, 0x33 / 255); // #c77d33
const INK: RGB = rgb(0x17 / 255, 0x21 / 255, 0x1e / 255); // #17211e
const LINE: RGB = rgb(0xb9 / 255, 0xc4 / 255, 0xc0 / 255); // #b9c4c0
const MUTED: RGB = rgb(0x57 / 255, 0x65 / 255, 0x5f / 255); // #57655f

// A4 in points
const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 42;
const CONTENT_W = PAGE_W - MARGIN * 2;

export interface OpdHospital {
  legalName: string; addressLine: string; city: string; state: string;
  stateCode: string; pincode: string; gstin: string | null; phone: string | null;
}
export interface OpdVitals {
  bpSystolic: number | null; bpDiastolic: number | null; pulse: number | null;
  tempF: number | null; spo2: number | null; heightCm: number | null; weightKg: number | null;
}
export interface OpdClinical {
  diagnosis: string | null;
  advice: string | null;
  /** Prescribed lab tests — advisory text on the sheet, printed as a numbered list. */
  labs: string[];
  nextVisit: string | null;
}
export interface OpdPdfData {
  hospital: OpdHospital | null;
  appointment: { opNumber: string; visitDate: string; time: string; referredByName: string | null; visitNumber: number };
  doctor: { name: string; specialization: string; department: string };
  patient: { displayId: string; fullName: string; age: number | null; gender: string | null; bloodGroup: string | null; phone: string; address: string | null; city: string | null };
  items: { medicineName: string; qty: number; dosage: string | null }[];
  vitals: OpdVitals | null;
  clinical?: OpdClinical | null;
}

const to12h = (hhmm: string) => {
  const [h, m] = (hhmm || "").split(":").map(Number);
  if (Number.isNaN(h)) return hhmm || "";
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m ?? 0).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
};
const prettyDate = (iso: string) => {
  const d = new Date(iso + "T00:00:00");
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

// Helvetica has no rupee glyph and can't encode Telugu — keep everything to
// Latin-1 so pdf-lib never throws on an odd character in a name or dosage.
const latin1 = (s: string) => (s ?? "").replace(/[^\x00-\xFF]/g, "");

/** Word-wrap `text` to fit `maxWidth` at `size`, returning the lines. */
function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = latin1(text).split(/\s+/).filter(Boolean);
  if (!words.length) return [""];
  const lines: string[] = [];
  let cur = words[0];
  for (let i = 1; i < words.length; i++) {
    const trial = `${cur} ${words[i]}`;
    if (font.widthOfTextAtSize(trial, size) <= maxWidth) cur = trial;
    else { lines.push(cur); cur = words[i]; }
  }
  lines.push(cur);
  return lines;
}

export async function generateOpdPdf(data: OpdPdfData): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`OPD Prescription ${data.appointment.opNumber}`);
  pdf.setProducer("Jeeva ERP");
  pdf.setCreator("Jeeva ERP");

  const reg = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const oblique = await pdf.embedFont(StandardFonts.HelveticaOblique);

  let page = pdf.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;

  const draw = (s: string, x: number, yy: number, size: number, font: PDFFont, color: RGB) =>
    page.drawText(latin1(s), { x, y: yy, size, font, color });
  const drawRight = (s: string, xRight: number, yy: number, size: number, font: PDFFont, color: RGB) => {
    const w = font.widthOfTextAtSize(latin1(s), size);
    page.drawText(latin1(s), { x: xRight - w, y: yy, size, font, color });
  };
  const drawCenter = (s: string, yy: number, size: number, font: PDFFont, color: RGB) => {
    const w = font.widthOfTextAtSize(latin1(s), size);
    page.drawText(latin1(s), { x: (PAGE_W - w) / 2, y: yy, size, font, color });
  };
  const hline = (yy: number, color = LINE, thickness = 0.75, x1 = MARGIN, x2 = PAGE_W - MARGIN) =>
    page.drawLine({ start: { x: x1, y: yy }, end: { x: x2, y: yy }, thickness, color });

  // guarantees room for the next block; starts a fresh page if not
  const ensure = (needed: number) => {
    if (y - needed < MARGIN + 46) {
      drawFooter(page, reg, bold, data.hospital);
      page = pdf.addPage([PAGE_W, PAGE_H]);
      y = PAGE_H - MARGIN;
      drawCenter("OPD PRESCRIPTION (continued)", y, 10, bold, TEAL);
      y -= 18;
      hline(y, TEAL, 1.5); y -= 14;
    }
  };

  // ── LETTERHEAD ────────────────────────────────────────────────────────────
  const hospName = (data.hospital?.legalName ?? "Jeeva Multi Speciality Hospital").toUpperCase();
  drawCenter(hospName, y, 16, bold, TEAL); y -= 15;
  const addr = data.hospital
    ? `${data.hospital.addressLine}, ${data.hospital.city}, ${data.hospital.state} - ${data.hospital.pincode}.`
    : "";
  if (addr) { drawCenter(addr, y, 9, reg, INK); y -= 12; }
  const contactBits = [
    data.hospital?.phone ? `Ph: ${data.hospital.phone}` : null,
    data.hospital?.gstin ? `GSTIN: ${data.hospital.gstin}` : null,
  ].filter(Boolean).join("   |   ");
  if (contactBits) { drawCenter(contactBits, y, 8.5, bold, TEAL); y -= 12; }
  y -= 2;
  hline(y, TEAL, 1.75); y -= 16;

  // ── TITLE ROW ─────────────────────────────────────────────────────────────
  draw("OPD PRESCRIPTION", MARGIN, y, 11, bold, TEAL);
  drawRight(`Dr. ${data.doctor.name}`, PAGE_W - MARGIN, y, 10.5, bold, INK);
  y -= 11.5;
  const metaBits = [
    `OP No: ${data.appointment.opNumber}`,
    `${prettyDate(data.appointment.visitDate)} - ${to12h(data.appointment.time)}`,
    `Visit #${data.appointment.visitNumber}`,
  ].join("   ·   ");
  draw(metaBits, MARGIN, y, 8.5, reg, MUTED);
  drawRight(`${data.doctor.specialization} · ${data.doctor.department}`, PAGE_W - MARGIN, y, 8, reg, MUTED);
  y -= 14;

  // ── PATIENT BLOCK ─────────────────────────────────────────────────────────
  const box = (label: string, value: string, x: number, w: number, yy: number) => {
    draw(label.toUpperCase(), x, yy, 7, bold, TEAL);
    const lines = wrap(value || "-", reg, 9.5, w);
    draw(lines[0], x, yy - 11, 9.5, reg, INK);
    return lines.length; // callers here keep values to one line
  };
  const ageSex = [
    data.patient.age != null ? `${data.patient.age}y` : null,
    data.patient.gender ?? null,
  ].filter(Boolean).join(", ");
  const nameVal = `${data.patient.fullName}${ageSex ? ` (${ageSex})` : ""}`;
  const col = CONTENT_W / 3;
  hline(y + 4); y -= 6;
  box("Patient", nameVal, MARGIN, col - 8, y);
  box("UHID", data.patient.displayId, MARGIN + col, col - 8, y);
  box("Phone", data.patient.phone, MARGIN + col * 2, col - 8, y);
  y -= 24;
  const address = [data.patient.address, data.patient.city].filter(Boolean).join(", ") || "-";
  box("Address", address, MARGIN, col * 2 - 8, y);
  box("Blood group", data.patient.bloodGroup ?? "-", MARGIN + col * 2, col - 8, y);
  y -= 22;
  hline(y + 6);
  y -= 10;

  // ── VITALS ────────────────────────────────────────────────────────────────
  const v = data.vitals;
  const heightM = v?.heightCm ? v.heightCm / 100 : null;
  const bmi = heightM && v?.weightKg ? v.weightKg / (heightM * heightM) : null;
  const bsa = v?.heightCm && v?.weightKg ? Math.sqrt((v.heightCm * v.weightKg) / 3600) : null;
  const vitalPairs: [string, string][] = [
    ["BP", v?.bpSystolic != null && v?.bpDiastolic != null ? `${v.bpSystolic}/${v.bpDiastolic}` : ""],
    ["Pulse", v?.pulse != null ? `${v.pulse}` : ""],
    ["Ht", v?.heightCm != null ? `${v.heightCm.toFixed(1)}cm` : ""],
    ["Wt", v?.weightKg != null ? `${v.weightKg.toFixed(1)}kg` : ""],
    ["Temp", v?.tempF != null ? `${v.tempF.toFixed(1)}F` : ""],
    ["BMI", bmi ? bmi.toFixed(1) : ""],
    ["SpO2", v?.spo2 != null ? `${v.spo2}%` : ""],
    ["BSA", bsa ? bsa.toFixed(2) : ""],
  ].filter(([, val]) => val !== "") as [string, string][];

  draw("VITALS", MARGIN, y, 7.5, bold, TEAL); y -= 12;
  if (vitalPairs.length) {
    let vx = MARGIN;
    for (const [label, val] of vitalPairs) {
      const lw = bold.widthOfTextAtSize(`${label} `, 9);
      const vw = reg.widthOfTextAtSize(val, 9);
      if (vx + lw + vw > PAGE_W - MARGIN) { y -= 13; vx = MARGIN; }
      draw(`${label} `, vx, y, 9, bold, MUTED);
      draw(val, vx + lw, y, 9, reg, INK);
      vx += lw + vw + 16;
    }
    y -= 16;
  } else {
    draw("Not recorded", MARGIN, y, 9, oblique, MUTED); y -= 16;
  }
  hline(y + 6); y -= 8;

  // ── DIAGNOSIS — typed when reception entered it, a pen line otherwise ─────
  const clin = data.clinical ?? null;
  ensure(30);
  draw("DIAGNOSIS", MARGIN, y, 7.5, bold, TEAL);
  if (clin?.diagnosis) {
    const dl = wrap(clin.diagnosis, bold, 10, CONTENT_W - 100);
    dl.forEach((ln, k) => draw(ln, MARGIN + 92, y - k * 12, 10, bold, INK));
    y -= (dl.length - 1) * 12;
  } else {
    page.drawLine({ start: { x: MARGIN + 92, y: y + 2 }, end: { x: PAGE_W - MARGIN, y: y + 2 }, thickness: 0.5, color: LINE });
  }
  y -= 16;
  hline(y + 6); y -= 8;

  // ── Rx TABLE ──────────────────────────────────────────────────────────────
  const cX = { idx: MARGIN, med: MARGIN + 26, qty: PAGE_W - MARGIN - 210, dose: PAGE_W - MARGIN - 170 };
  const medW = cX.qty - cX.med - 10;
  const doseW = PAGE_W - MARGIN - cX.dose;

  ensure(40);
  draw("Rx", MARGIN, y, 12, bold, TEAL);
  y -= 6;
  hline(y, TEAL, 1.5); y -= 12;
  draw("#", cX.idx, y, 8, bold, TEAL);
  draw("MEDICINE", cX.med, y, 8, bold, TEAL);
  draw("QTY", cX.qty, y, 8, bold, TEAL);
  draw("DOSAGE & INSTRUCTIONS", cX.dose, y, 8, bold, TEAL);
  y -= 5;
  hline(y, TEAL, 1); y -= 13;

  if (!data.items.length) {
    draw("No medicines listed.", cX.med, y, 9.5, oblique, MUTED); y -= 16;
  } else {
    data.items.forEach((it, i) => {
      const medLines = wrap(it.medicineName || "-", reg, 9.5, medW);
      const doseLines = wrap(it.dosage || "-", reg, 9, doseW);
      const rows = Math.max(medLines.length, doseLines.length);
      ensure(rows * 12 + 10);
      draw(`${i + 1}`, cX.idx, y, 9.5, bold, INK);
      medLines.forEach((ln, k) => draw(ln, cX.med, y - k * 12, 9.5, k === 0 ? bold : reg, INK));
      draw(`× ${it.qty}`, cX.qty, y, 9.5, reg, INK);
      doseLines.forEach((ln, k) => draw(ln, cX.dose, y - k * 12, 9, reg, k === 0 ? INK : MUTED));
      y -= rows * 12 + 6;
      hline(y + 3, LINE, 0.5);
      y -= 6;
    });
  }
  y -= 6;

  // ── LAB INVESTIGATIONS / ADVICE / NEXT VISIT ──────────────────────────────
  // Typed values print in ink; whatever wasn't typed stays a pen line.
  const ruled = (label: string, x: number, w: number) => {
    draw(label.toUpperCase(), x, y, 7.5, bold, TEAL);
    page.drawLine({ start: { x: x + 92, y: y + 2 }, end: { x: x + w, y: y + 2 }, thickness: 0.5, color: LINE });
  };

  // prescribed lab tests — numbered, two columns when the list is long
  ensure(34);
  if (clin?.labs?.length) {
    draw("LAB INVESTIGATIONS ADVISED", MARGIN, y, 7.5, bold, TEAL); y -= 14;
    const twoCol = clin.labs.length > 4;
    const colW = twoCol ? CONTENT_W / 2 - 12 : CONTENT_W;
    const rows = twoCol ? Math.ceil(clin.labs.length / 2) : clin.labs.length;
    const yTop = y;
    clin.labs.forEach((t, i) => {
      const colX = twoCol && i >= rows ? MARGIN + CONTENT_W / 2 + 12 : MARGIN;
      const rowY = yTop - (twoCol ? i % rows : i) * 13;
      draw(`${(i + 1)}.`, colX + 2, rowY, 9, bold, TEAL);
      draw(wrap(t, reg, 9.5, colW - 22)[0], colX + 18, rowY, 9.5, reg, INK);
    });
    y = yTop - rows * 13 - 4;
  } else {
    ruled("Tests prescribed", MARGIN, CONTENT_W); y -= 20;
  }

  // advice — wrapped paragraph when typed
  ensure(30);
  if (clin?.advice) {
    draw("ADVICE", MARGIN, y, 7.5, bold, TEAL);
    const al = wrap(clin.advice, reg, 9.5, CONTENT_W - 100);
    al.forEach((ln, k) => { ensure(14); draw(ln, MARGIN + 92, y - k * 12, 9.5, reg, INK); });
    y -= (al.length - 1) * 12 + 20;
  } else {
    ruled("Advice", MARGIN, CONTENT_W); y -= 20;
  }

  // next visit
  ensure(24);
  draw("NEXT VISIT", MARGIN, y, 7.5, bold, TEAL);
  if (clin?.nextVisit) {
    draw(clin.nextVisit, MARGIN + 92, y, 10, bold, INK);
  } else {
    page.drawLine({ start: { x: MARGIN + 92, y: y + 2 }, end: { x: MARGIN + CONTENT_W * 0.5, y: y + 2 }, thickness: 0.5, color: LINE });
  }
  y -= 34;

  // ── SIGNATURE ─────────────────────────────────────────────────────────────
  ensure(56);
  const sigRight = PAGE_W - MARGIN;
  page.drawLine({ start: { x: sigRight - 170, y }, end: { x: sigRight, y }, thickness: 0.75, color: INK });
  y -= 12;
  drawRight(`Dr. ${data.doctor.name}`, sigRight, y, 10, bold, INK); y -= 11;
  drawRight(`${data.doctor.specialization} · ${data.doctor.department}`, sigRight, y, 8, reg, MUTED);
  draw("Computer-generated prescription. Not valid for medico-legal", MARGIN, y + 11, 8, reg, MUTED);
  draw("use without the doctor's signature.", MARGIN, y + 1, 8, reg, MUTED);
  y -= 18;

  drawFooter(page, reg, bold, data.hospital);

  const bytes = await pdf.save();
  return Buffer.from(bytes);
}

function drawFooter(page: PDFPage, reg: PDFFont, bold: PDFFont, hospital: OpdHospital | null) {
  const bandH = 26;
  page.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: 3, color: AMBER });
  page.drawRectangle({ x: 0, y: 3, width: PAGE_W, height: bandH, color: TEAL });
  const name = latin1(hospital?.legalName ?? "Jeeva Multi Speciality Hospital");
  const addr = hospital ? latin1(`${hospital.addressLine}, ${hospital.city} - ${hospital.pincode}`) : "";
  page.drawText(name, { x: MARGIN, y: 13, size: 8.5, font: bold, color: rgb(1, 1, 1) });
  if (addr) {
    const w = reg.widthOfTextAtSize(addr, 7.5);
    page.drawText(addr, { x: PAGE_W - MARGIN - w, y: 13.5, size: 7.5, font: reg, color: rgb(0.9, 0.95, 0.93) });
  }
  const note = "This is a computer-generated prescription from Jeeva ERP.";
  const nw = reg.widthOfTextAtSize(note, 6.5);
  page.drawText(note, { x: (PAGE_W - nw) / 2, y: 5.5, size: 6.5, font: reg, color: rgb(0.85, 0.92, 0.9) });
}
