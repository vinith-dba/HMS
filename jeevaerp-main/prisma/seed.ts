import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

/**
 * Dev seed. Idempotent. Passwords/emails here are for local development only.
 * Staff log in with USERNAME (role.name) + OTP (code prints to server console),
 * or username + password. Their email is the OTP backup channel.
 */
async function main() {
  const password = await bcrypt.hash("Password123!", 12);

  // ---- Staff: username is role.name; email is the OTP backup ----
  const staff = [
    { username: "admin.priya",     phone: "9000000001", email: "priya.admin@jeeva.local",   name: "Priya (Admin)",   role: "ADMIN" as const },
    { username: "reception.ravi",  phone: "9000000002", email: "ravi.front@jeeva.local",    name: "Ravi (Reception)",role: "RECEPTIONIST" as const },
    { username: "labs.sana",       phone: "9000000003", email: "sana.labs@jeeva.local",     name: "Sana (Lab)",      role: "LAB_TECH" as const },
    { username: "pharmacy.kiran",  phone: "9000000004", email: "kiran.pharma@jeeva.local",  name: "Kiran (Pharmacy)",role: "PHARMACIST" as const },
  ];
  for (const s of staff) {
    await prisma.user.upsert({
      where: { username: s.username },
      update: { email: s.email, name: s.name, role: s.role },
      create: { ...s, passwordHash: password },
    });
  }

  // ---- Doctors (each also a login; username doctor.<surname>) ----
  // Profile fields (photo, qualification, experience…) power the booking cards
  // and the public directory. Photos live in /public/images.
  const doctors = [
    { username: "doctor.rao",   phone: "9000001001", email: "rao@jeeva.local",   name: "Dr. K. Rao",   specialization: "Interventional Cardiologist", department: "Cardiology",   fee: 700, qualification: "MBBS, MD, DM (Cardiology)", experienceYears: 18, age: 49, languages: "Telugu, English, Hindi", photoUrl: "/images/doctor-1.avif",  bio: "Two decades treating chest pain, blood pressure and heart rhythm — with ECG, 2D echo and TMT done the same day, in-house." },
    { username: "doctor.menon", phone: "9000001002", email: "menon@jeeva.local", name: "Dr. S. Menon", specialization: "Obstetrician & Gynaecologist", department: "Gynaecology",  fee: 600, qualification: "MBBS, MS (OBG)",            experienceYears: 14, age: 43, languages: "Telugu, English, Malayalam", photoUrl: "/images/doctor-2.avif",  bio: "Antenatal care through delivery, and women's health at every stage of life." },
    { username: "doctor.verma", phone: "9000001003", email: "verma@jeeva.local", name: "Dr. A. Verma", specialization: "Orthopaedic Surgeon",          department: "Orthopaedics", fee: 650, qualification: "MBBS, MS (Ortho)",          experienceYears: 16, age: 46, languages: "Telugu, English, Hindi", photoUrl: "/images/doctor-3.avif",  bio: "Fractures, joint pain and spine trouble, with digital X-ray on site so you don't travel for a scan." },
    { username: "doctor.das",   phone: "9000001004", email: "das@jeeva.local",   name: "Dr. P. Das",   specialization: "Paediatrician",                department: "Paediatrics",  fee: 400, qualification: "MBBS, DCH, MD (Paed)",      experienceYears: 11, age: 38, languages: "Telugu, English, Bengali", photoUrl: "/images/doctor-10.avif", bio: "Newborns to teenagers — vaccinations, fevers, growth checks and the 2 a.m. worries." },
  ];
  for (const d of doctors) {
    const user = await prisma.user.upsert({
      where: { username: d.username },
      update: {},
      create: { username: d.username, phone: d.phone, email: d.email, name: d.name, role: "DOCTOR", passwordHash: password },
    });
    const profile = {
      name: d.name, specialization: d.specialization, department: d.department, consultationFee: d.fee,
      qualification: d.qualification, experienceYears: d.experienceYears, age: d.age, languages: d.languages,
      photoUrl: d.photoUrl, bio: d.bio,
    };
    const doctor = await prisma.doctor.upsert({
      where: { userId: user.id },
      update: profile,
      create: { userId: user.id, ...profile },
    });
    for (let day = 1; day <= 6; day++) {
      await prisma.doctorSchedule.upsert({
        where: { doctorId_dayOfWeek_startTime: { doctorId: doctor.id, dayOfWeek: day, startTime: "09:00" } },
        update: {},
        create: { doctorId: doctor.id, dayOfWeek: day, startTime: "09:00", endTime: "13:00", slotDurationMin: 15 },
      });
    }
  }

  // ---- Demo patient (fixed ID for OTP login testing) ----
  await prisma.patient.upsert({
    where: { displayId: "JMH2026OP00001" },
    update: {},
    create: {
      displayId: "JMH2026OP00001",
      firstName: "Ramesh", lastName: "Kumar", fullName: "Ramesh Kumar",
      phone: "9848012345", gender: "MALE", bloodGroup: "B+", city: "Hanamkonda",
    },
  });

  // ---- Counters so generated IDs continue past the seed ----
  const year = new Date().getFullYear();
  await prisma.counter.upsert({ where: { key: `PATIENT-${year}` }, update: {}, create: { key: `PATIENT-${year}`, value: 1 } });

  // ---- Generate bookable slots for the next 7 days from doctor schedules ----
  const allSchedules = await prisma.doctorSchedule.findMany({ where: { isActive: true } });
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const slotRows: { doctorId: string; date: Date; startTime: string; endTime: string }[] = [];
  const toMin = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
  const toHHMM = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  for (let d = 0; d < 7; d++) {
    const date = new Date(start); date.setDate(start.getDate() + d);
    for (const sch of allSchedules) {
      if (sch.dayOfWeek !== date.getDay()) continue;
      for (let t = toMin(sch.startTime); t + sch.slotDurationMin <= toMin(sch.endTime); t += sch.slotDurationMin) {
        slotRows.push({ doctorId: sch.doctorId, date, startTime: toHHMM(t), endTime: toHHMM(t + sch.slotDurationMin) });
      }
    }
  }
  if (slotRows.length) {
    const r = await prisma.doctorSlot.createMany({ data: slotRows, skipDuplicates: true });
    console.log(`   Generated ${r.count} bookable slots for the next 7 days.`);
  }

  // ---- Hospital config (GST invoice header). Telangana state code = 36. ----
  const existingConfig = await prisma.hospitalConfig.findFirst();
  if (!existingConfig) {
    await prisma.hospitalConfig.create({
      data: {
        legalName: "Jeeva Multi Speciality Hospital",
        addressLine: "# 1-8-81, Sai Nagar, Beside Swimming Pool, Balasamudram",
        city: "Hanamkonda",
        state: "Telangana",
        stateCode: "36",
        pincode: "506001",
        gstin: "36AACCA1234F1Z5", // placeholder — replace with the real GSTIN
        phone: "9704691308",
        email: "info@jeevamultispecialityhospital.com",
        defaultLabGstPct: 0, // diagnostics are generally GST-exempt
      },
    });
  }

  // ---- Lab test catalog. gstRatePct = 0 (EXEMPT) by default. ----
  // Most diagnostic services are GST-exempt in India. The hospital's CA should
  // confirm and override any test that is actually taxable.
  const labTests = [
    { name: "Complete Blood Picture (CBP)", code: "CBP", price: 300 },
    { name: "Blood Sugar — Fasting", code: "FBS", price: 120 },
    { name: "Blood Sugar — Postprandial", code: "PPBS", price: 120 },
    { name: "HbA1c", code: "HBA1C", price: 600 },
    { name: "Lipid Profile", code: "LIPID", price: 800 },
    { name: "Liver Function Test (LFT)", code: "LFT", price: 900 },
    { name: "Kidney Function Test (KFT)", code: "KFT", price: 900 },
    { name: "Thyroid Profile (T3 T4 TSH)", code: "THYROID", price: 700 },
    { name: "Urine Routine", code: "URINE", price: 150 },
    { name: "Serum Creatinine", code: "CREAT", price: 200 },
    { name: "Vitamin D (25-OH)", code: "VITD", price: 1400 },
    { name: "Vitamin B12", code: "VITB12", price: 1100 },
    { name: "CRP (C-Reactive Protein)", code: "CRP", price: 500 },
    { name: "RA Factor", code: "RAF", price: 450 },
    { name: "ESR", code: "ESR", price: 150 },
    { name: "Dengue NS1 Antigen", code: "DENGUE", price: 800 },
    { name: "Widal Test", code: "WIDAL", price: 300 },
    { name: "X-Ray Chest PA", code: "XRAYCHEST", price: 350 },
    { name: "ECG", code: "ECG", price: 250 },
    { name: "2D Echo", code: "ECHO", price: 1500 },
  ];
  for (const t of labTests) {
    await prisma.labTestCatalog.upsert({
      where: { name: t.name },
      update: {},
      create: { name: t.name, code: t.code, price: t.price, gstRatePct: 0, active: true },
    });
  }
  console.log(`   Seeded ${labTests.length} lab tests (GST 0% = exempt by default).`);

  console.log("✅ Seed complete.");
  console.log("   Staff login (username + OTP to console, or password Password123!):");
  console.log("     admin.priya · reception.ravi · labs.sana · pharmacy.kiran · doctor.rao");
  console.log("   Patient OTP login: JMH2026OP00001  (code prints to server console)");
  // ---- Pharmacy: medicines + stock batches -------------------------------
  // Medicines ARE taxable in India (unlike diagnostics, which are exempt).
  // Most are 5%; a few categories sit at 12%. Confirm rates with the CA.
  const medicines = [
    { name: "Paracetamol 650mg",      generic: "Paracetamol",            mfr: "Cipla",     hsn: "3004", gst: 5,  unit: "tablet", reorder: 100, rack: "A1" },
    { name: "Azithromycin 500mg", courseCritical: true,     generic: "Azithromycin",           mfr: "Alkem",     hsn: "3004", gst: 5,  unit: "tablet", reorder: 40,  rack: "A2" },
    { name: "Amoxicillin 500mg", courseCritical: true,      generic: "Amoxicillin",            mfr: "Cipla",     hsn: "3004", gst: 5,  unit: "capsule", reorder: 60, rack: "A2" },
    { name: "Pantoprazole 40mg",      generic: "Pantoprazole",           mfr: "Sun Pharma",hsn: "3004", gst: 5,  unit: "tablet", reorder: 50,  rack: "A3" },
    { name: "Metformin 500mg",        generic: "Metformin HCl",          mfr: "USV",       hsn: "3004", gst: 5,  unit: "tablet", reorder: 80,  rack: "B1" },
    { name: "Amlodipine 5mg",         generic: "Amlodipine Besylate",    mfr: "Torrent",   hsn: "3004", gst: 5,  unit: "tablet", reorder: 60,  rack: "B1" },
    { name: "Atorvastatin 10mg",      generic: "Atorvastatin Calcium",   mfr: "Zydus",     hsn: "3004", gst: 5,  unit: "tablet", reorder: 50,  rack: "B2" },
    { name: "Cetirizine 10mg",        generic: "Cetirizine HCl",         mfr: "Dr Reddy's",hsn: "3004", gst: 5,  unit: "tablet", reorder: 80,  rack: "C1" },
    { name: "Ibuprofen 400mg",        generic: "Ibuprofen",              mfr: "Abbott",    hsn: "3004", gst: 5,  unit: "tablet", reorder: 60,  rack: "C1" },
    { name: "Omeprazole 20mg",        generic: "Omeprazole",             mfr: "Dr Reddy's",hsn: "3004", gst: 5,  unit: "capsule", reorder: 50, rack: "A3" },
    { name: "Metronidazole 400mg", courseCritical: true,    generic: "Metronidazole",          mfr: "Alkem",     hsn: "3004", gst: 5,  unit: "tablet", reorder: 40,  rack: "C2" },
    { name: "Losartan 50mg",          generic: "Losartan Potassium",     mfr: "Torrent",   hsn: "3004", gst: 5,  unit: "tablet", reorder: 40,  rack: "B2" },
    { name: "Levocetirizine 5mg",     generic: "Levocetirizine",         mfr: "Cipla",     hsn: "3004", gst: 5,  unit: "tablet", reorder: 50,  rack: "C1" },
    { name: "Diclofenac Gel 30g",     generic: "Diclofenac Diethylamine",mfr: "Novartis",  hsn: "3004", gst: 12, unit: "tube",   reorder: 15,  rack: "D1" },
    { name: "ORS Sachet",             generic: "Oral Rehydration Salts", mfr: "FDC",       hsn: "3004", gst: 5,  unit: "sachet", reorder: 40,  rack: "D2" },
    { name: "Cough Syrup 100ml",      generic: "Dextromethorphan",       mfr: "Glenmark",  hsn: "3004", gst: 12, unit: "bottle", reorder: 20,  rack: "D2" },
    { name: "Insulin Glargine 100IU", generic: "Insulin Glargine",       mfr: "Biocon",    hsn: "3004", gst: 5,  unit: "vial",   reorder: 10,  rack: "F1" },
    { name: "Vitamin D3 60000IU",     generic: "Cholecalciferol",        mfr: "Mankind",   hsn: "3004", gst: 5,  unit: "sachet", reorder: 25,  rack: "E1" },
    { name: "Iron + Folic Acid",      generic: "Ferrous Ascorbate",      mfr: "Emcure",    hsn: "3004", gst: 5,  unit: "tablet", reorder: 40,  rack: "E1" },
    { name: "Salbutamol Inhaler",     generic: "Salbutamol Sulphate",    mfr: "Cipla",     hsn: "3004", gst: 12, unit: "inhaler",reorder: 10,  rack: "F2" },
  ];

  // Batch dates: one comfortably in-date, one deliberately near expiry so the
  // FEFO logic and the expiry alerts have something real to chew on.
  const farExpiry  = new Date(); farExpiry.setFullYear(farExpiry.getFullYear() + 2);
  const nearExpiry = new Date(); nearExpiry.setDate(nearExpiry.getDate() + 45);

  for (const [i, m] of medicines.entries()) {
    // `update: {}` was a trap. On a database that already had these medicines,
    // the upsert matched by name, ran an EMPTY update, and skipped them — so any
    // column added to the seed AFTER the first run (rackLocation, courseCritical)
    // never reached existing rows. The racks were in this file and would never
    // have arrived in the database. Re-seeding must REPAIR, not silently skip.
    //
    // Catalogue facts (rack, GST, reorder level, course-critical) are owned by the
    // seed and are safe to re-assert. Stock levels and batches are NOT touched here.
    const catalogue = {
      genericName: m.generic,
      manufacturer: m.mfr,
      hsnCode: m.hsn,
      gstRatePct: m.gst.toFixed(2),
      unit: m.unit,
      reorderThreshold: m.reorder,
      rackLocation: m.rack,
      courseCritical: (m as { courseCritical?: boolean }).courseCritical ?? false,
    };
    const med = await prisma.medicine.upsert({
      where: { name: m.name },
      update: catalogue,
      create: { name: m.name, ...catalogue },
      select: { id: true },
    });

    const mrp = 12 + i * 7;                 // spread of realistic prices
    const lowOne = i % 7 === 0;             // a few sit below reorder level

    await prisma.stockBatch.upsert({
      where: { medicineId_batchNo: { medicineId: med.id, batchNo: `B${2026}${String(i + 1).padStart(3, "0")}` } },
      update: {},
      create: {
        medicineId: med.id,
        batchNo: `B${2026}${String(i + 1).padStart(3, "0")}`,
        expiryDate: farExpiry,
        quantity: lowOne ? 4 : 120 + i * 5,
        purchasePrice: (mrp * 0.7).toFixed(2),
        mrp: mrp.toFixed(2),
      },
    });

    // every 4th medicine also gets an older batch expiring soon — FEFO must
    // dispense THIS one first, and it should show up under alerts.
    if (i % 4 === 0) {
      await prisma.stockBatch.upsert({
        where: { medicineId_batchNo: { medicineId: med.id, batchNo: `B${2025}${String(i + 1).padStart(3, "0")}` } },
        update: {},
        create: {
          medicineId: med.id,
          batchNo: `B${2025}${String(i + 1).padStart(3, "0")}`,
          expiryDate: nearExpiry,
          quantity: 18,
          purchasePrice: (mrp * 0.7).toFixed(2),
          mrp: mrp.toFixed(2),
        },
      });
    }
  }
  console.log(`  ✓ ${medicines.length} medicines seeded with stock batches (incl. near-expiry for FEFO)`);

  // ---- IPD: wards + beds --------------------------------------------------
  // GST on room rent: exempt below ₹5,000/day (non-ICU). ICU is exempt regardless.
  // So only the ₹5,500 Private ward carries 5%. Confirm with the CA before go-live.
  const wards = [
    { name: "General Ward",   category: "GENERAL",      floor: "1st Floor", dailyCharge: 1500, gstRatePct: 0, beds: 10, prefix: "GW" },
    { name: "Semi-Private",   category: "SEMI_PRIVATE", floor: "2nd Floor", dailyCharge: 3000, gstRatePct: 0, beds: 6,  prefix: "SP" },
    { name: "Private Room",   category: "PRIVATE",      floor: "2nd Floor", dailyCharge: 5500, gstRatePct: 5, beds: 4,  prefix: "PR" },
    { name: "ICU",            category: "ICU",          floor: "3rd Floor", dailyCharge: 8000, gstRatePct: 0, beds: 4,  prefix: "ICU" },
  ];

  for (const w of wards) {
    const ward = await prisma.ward.upsert({
      where: { name: w.name },
      update: {},
      create: {
        name: w.name, category: w.category, floor: w.floor,
        dailyCharge: w.dailyCharge, gstRatePct: w.gstRatePct, active: true,
      },
    });
    for (let i = 1; i <= w.beds; i++) {
      const bedNo = `${w.prefix}-${String(i).padStart(2, "0")}`;
      await prisma.bed.upsert({
        where: { wardId_bedNo: { wardId: ward.id, bedNo } },
        update: {},
        create: { wardId: ward.id, bedNo, status: "AVAILABLE" },
      });
    }
  }
  const totalBeds = wards.reduce((n, w) => n + w.beds, 0);
  console.log(`  ✓ ${wards.length} wards / ${totalBeds} beds seeded (Private ₹5,500 carries 5% GST, rest exempt)`);

}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());