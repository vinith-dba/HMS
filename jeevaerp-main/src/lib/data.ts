/**
 * Public site content.
 *
 * Copy principle: a person landing here is usually worried, often on a phone,
 * often on behalf of a parent. They want three answers fast — can I be seen
 * today, where are you, and who will I see. Everything else is secondary.
 * No "world-class healthcare solutions". Plain words, specific facts.
 */

export const HOSPITAL = {
  name: "Jeeva Multispeciality Hospital",
  shortName: "Jeeva",
  tagline: "Multispecialty care in Hanamkonda",
  address: "Road No. 4, Near Asian Cinema, Baala Samudhram, Hanamkonda, Telangana – 506001",
  locality: "Hanamkonda, Warangal",
  email: "info@jeevamultispecialityhospital.com",
  phone: "+91 87 6543 2100",
  emergency: "+91 87 6543 2100",
  opdHours: "8:00 AM – 8:00 PM",
  opdDays: "Monday to Saturday",
  mapUrl: "https://maps.google.com/?q=Hanamkonda,Telangana",
};

export interface Department {
  index: string;
  name: string;
  blurb: string;
  /** Anchors the card in something concrete a patient recognises. */
  common: string;
  /** Drop the photo into /public/images with this name and it appears;
   *  until then a designed icon tile renders in its place. */
  image: string;
}

export const DEPARTMENTS: Department[] = [
  { index: "01", name: "Cardiology",       blurb: "Chest pain, blood pressure and heart rhythm — assessed the same day, with ECG and echo in-house.", common: "ECG · 2D Echo · TMT",         image: "/images/dept-cardiology.jpg" },
  { index: "02", name: "Orthopaedics",     blurb: "Fractures, joint pain and spine trouble. Digital X-ray on site, so you don't travel for a scan.", common: "Fractures · Knee · Spine",    image: "/images/dept-orthopaedics.jpg" },
  { index: "03", name: "Gynaecology",      blurb: "Antenatal care through delivery, and women's health at every stage of life.", common: "Antenatal · Delivery · Scan",                      image: "/images/dept-gynaecology.jpg" },
  { index: "04", name: "Paediatrics",      blurb: "Newborns to teenagers — vaccinations, fevers, growth checks and the 2 a.m. worries.", common: "Vaccines · Fever · Growth",               image: "/images/dept-paediatrics.jpg" },
  { index: "05", name: "General Medicine", blurb: "The first door for fever, infection, diabetes and blood pressure. Where most visits start.", common: "Fever · Diabetes · BP",            image: "/images/dept-general-medicine.jpg" },
  { index: "06", name: "Neurology",        blurb: "Persistent headache, seizures and stroke care, supported by in-house imaging.", common: "Headache · Seizure · Stroke",                   image: "/images/dept-neurology.jpg" },
  { index: "07", name: "Dermatology",      blurb: "Skin, hair and allergy problems, with lab diagnostics to back the diagnosis.", common: "Skin · Hair · Allergy",                          image: "/images/dept-dermatology.jpg" },
  { index: "08", name: "ENT",              blurb: "Ear, nose and throat — from hearing tests to minor day procedures.", common: "Hearing · Sinus · Throat",                                 image: "/images/dept-ent.jpg" },
];

/** Fast lanes for what people actually come in for — each maps to the
 *  department that treats it, pre-filtered on the booking page. */
export const QUICK_NEEDS = [
  { label: "Fever & infections", note: "Seasonal fevers, flu, typhoid — seen same day.", dept: "General Medicine", icon: "Fever" },
  { label: "Disease prevention", note: "Vaccinations, screenings and health checkups.",  dept: "General Medicine", icon: "Prevention" },
  { label: "Children",           note: "Newborn care to teens — growth and vaccines.",   dept: "Paediatrics",      icon: "Paediatrics" },
  { label: "Pregnancy",          note: "Antenatal visits, scans and safe delivery.",     dept: "Gynaecology",      icon: "Gynaecology" },
] as const;

export interface Doctor {
  id: string;
  name: string;
  specialization: string;
  department: string;
  qualification: string;
  experience: number;
  age: number;
  fee: number;
  opd: string;
  days: string;
  image: string;
}

export const DOCTORS: Doctor[] = [
  { id: "d1", name: "Dr. K. Rao",       specialization: "Interventional Cardiologist",  department: "Cardiology",       qualification: "MBBS, MD, DM (Cardiology)", experience: 18, age: 49, fee: 700, opd: "9:00 – 13:00",  days: "Mon–Sat",  image: "/images/doctor-1.avif" },
  { id: "d2", name: "Dr. S. Menon",     specialization: "Obstetrician & Gynaecologist", department: "Gynaecology",      qualification: "MBBS, MS (OBG)",            experience: 14, age: 43, fee: 600, opd: "10:00 – 14:00", days: "Mon–Sat",  image: "/images/doctor-2.avif" },
  { id: "d3", name: "Dr. A. Verma",     specialization: "Orthopaedic Surgeon",          department: "Orthopaedics",     qualification: "MBBS, MS (Ortho)",          experience: 16, age: 46, fee: 650, opd: "9:00 – 13:00",  days: "Mon–Sat",  image: "/images/doctor-3.avif" },
  { id: "d4", name: "Dr. P. Das",       specialization: "Paediatrician",                department: "Paediatrics",      qualification: "MBBS, DCH, MD (Paed)",      experience: 11, age: 38, fee: 400, opd: "9:00 – 17:00",  days: "Mon–Sat",  image: "/images/doctor-10.avif" },
  { id: "d5", name: "Dr. N. Iqbal",     specialization: "General Physician",            department: "General Medicine", qualification: "MBBS, MD (Gen. Medicine)",  experience: 9,  age: 36, fee: 400, opd: "8:00 – 20:00",  days: "Daily",    image: "/images/doctor-5.avif" },
  { id: "d6", name: "Dr. R. Kulkarni",  specialization: "Neurologist",                  department: "Neurology",        qualification: "MBBS, MD, DM (Neurology)",  experience: 20, age: 51, fee: 800, opd: "10:00 – 14:00", days: "Tue–Sat",  image: "/images/doctor-6.avif" },
  { id: "d7", name: "Dr. T. Prasanna",  specialization: "Dermatologist",                department: "Dermatology",      qualification: "MBBS, MD (DVL)",            experience: 8,  age: 34, fee: 500, opd: "11:00 – 16:00", days: "Mon–Fri",  image: "/images/doctor-7.avif" },
  { id: "d8", name: "Dr. V. George",    specialization: "ENT Surgeon",                  department: "ENT",              qualification: "MBBS, MS (ENT)",            experience: 13, age: 41, fee: 550, opd: "9:00 – 13:00",  days: "Mon–Sat",  image: "/images/doctor-8.avif" },
];

/** Counted up on scroll. Tabular numerals, no decoration. */
export const STATS = [
  { value: 8,  suffix: "",    label: "Departments",       sub: "under one roof" },
  { value: 12, suffix: "+",   label: "Specialists",       sub: "consulting daily" },
  { value: 24, suffix: "×7",  label: "Emergency",         sub: "never closed" },
  { value: 30, suffix: "min", label: "Report turnaround", sub: "for routine bloods" },
];

/**
 * The care model. Replaces the old generic blurbs.
 * Each pillar is a claim we can actually stand behind — because the ERP
 * behind this site genuinely does it.
 */
export const CARE_MODEL = [
  {
    index: "01",
    title: "One ID, for life",
    text: "You are registered once and given a permanent Jeeva ID. Every visit, every scan, every prescription and every bill attaches to that one number — so nothing is lost between departments, and nothing is asked of you twice.",
  },
  {
    index: "02",
    title: "Your history is already on the screen",
    text: "By the time you sit down, the doctor can see your past visits, your last blood report and what you were prescribed in March. You should not have to be your own medical record.",
  },
  {
    index: "03",
    title: "Diagnostics and pharmacy in the building",
    text: "Tests are ordered straight to our lab, and results land on your record the moment they are ready. Medicines are dispensed from batch-tracked stock against your ID, with a proper GST bill in your hand.",
  },
];

export const JOURNEY = [
  { step: "01", title: "Register",    text: "The front desk issues your permanent Jeeva ID. It takes about two minutes, and you only ever do it once." },
  { step: "02", title: "Consult",     text: "You meet your doctor with your full history already open in front of them — no lost files, no repeating yourself." },
  { step: "03", title: "Diagnostics", text: "Any tests advised go straight to our lab. Reports upload to your record the moment they are ready." },
  { step: "04", title: "Pharmacy",    text: "Prescribed medicines are dispensed against your ID from verified, batch-tracked stock. GST bill in hand." },
];

export const IMAGES = {
  heroBuilding: "/images/hero-building.jpg",
  equipment: "/images/facility-equipment.jpg",
  ward: "/images/facility-ward.jpg",
};

/**
 * Rooms & pricing — PUBLISHED, deliberately.
 * Most hospital sites hide rates; families find out at the billing counter on
 * the worst day of their week. These are the same figures the ERP charges from
 * (and locks at admission), so the website and the bill cannot disagree.
 * Room rent above ₹5,000/day attracts 5% GST (non-ICU); ICU is exempt.
 */
export const WARDS = [
  { name: "General Ward",  beds: 10, price: 1500, gst: 0, floor: "1st floor",
    note: "Shared hall, curtained bays. Nursing round the clock.",
    includes: ["Nursing care", "Doctor's daily round", "Attendant chair"] },
  { name: "Semi-Private",  beds: 6,  price: 3000, gst: 0, floor: "2nd floor",
    note: "Two beds to a room. A little quiet, without the private price.",
    includes: ["Everything in General", "Two-bed room", "Attendant bench"] },
  { name: "Private Room",  beds: 4,  price: 5500, gst: 5, floor: "2nd floor",
    note: "Your own room, your own bathroom, a proper attendant bed.",
    includes: ["Everything in Semi-Private", "Attached bathroom", "Attendant bed", "AC"] },
  { name: "ICU",           beds: 4,  price: 8000, gst: 0, floor: "3rd floor",
    note: "Monitored critical care. One nurse is never far from your person.",
    includes: ["Continuous monitoring", "Critical-care nursing", "Ventilator support"] },
] as const;

/** Questions the front desk answers fifty times a day — answered once, here. */
export const FAQ = [
  {
    q: "What should I bring on my first visit?",
    a: "Just yourself, a phone number, and any old reports or prescriptions you have. Reception registers you in about two minutes and issues your Jeeva ID (it looks like JMH2026OP00123). Every visit after that, the ID is all you need — your history is already with us.",
  },
  {
    q: "Do I pay before or after seeing the doctor?",
    a: "The consultation is billed when you book at the desk — you'll get a printed receipt with the fee on it. Medicines and lab tests, if the doctor advises any, are billed separately at the pharmacy and lab counters, so you only ever pay for what you actually take.",
  },
  {
    q: "How do I collect my lab reports?",
    a: "Routine blood work is usually ready in about 30 minutes. You can collect a printout from the lab counter, or sign in to the patient portal with your Jeeva ID and download it from your phone — every report you've ever had here stays in one place.",
  },
  {
    q: "Can my medicines be bought outside?",
    a: "Of course. The doctor's prescription is yours — our in-house pharmacy simply has the medicines the doctors here actually prescribe, checks expiry dates automatically, and bills with proper GST receipts. If we're short-stocked, we'll say so rather than substitute quietly.",
  },
  {
    q: "Can someone stay with an admitted patient?",
    a: "Yes — one attendant per patient, and we record their name and phone at admission so the ward can reach the right person immediately. General ward has attendant chairs; private rooms have a proper attendant bed.",
  },
  {
    q: "What payment methods do you accept?",
    a: "Cash, UPI, and cards at every counter — consultation, pharmacy, lab, and admissions. Every payment gets a printed, GST-compliant receipt with a receipt number, and any past bill can be reprinted at the desk if you lose yours.",
  },
] as const;

/** Every sign-in the building has. Patients first; staff below. */
export const PORTALS = [
  { key: "portal",    label: "Patient portal",   sub: "Your visits, reports & prescriptions", staff: false, path: "/portal/login" },
  { key: "reception", label: "Reception",        sub: "Front desk · OPD · admissions",        staff: true },
  { key: "doctor",    label: "Doctors",          sub: "Queue, patient files & history",       staff: true },
  { key: "labs",      label: "Laboratory",       sub: "Test queue & report uploads",          staff: true },
  { key: "pharmacy",  label: "Pharmacy",         sub: "Dispensing & stock",                   staff: true },
  { key: "admin",     label: "Administration",   sub: "Staff, wards, rates & audit",          staff: true },
] as const;
