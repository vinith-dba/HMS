"use client";

import { useState } from "react";
import { Card, PrimaryButton } from "@/components/portal/ui/primitives";
import { Icon } from "@/components/portal/ui/icons";
import { Field, Spinner, SuccessCheck } from "@/components/portal/ui/form-atoms";
import { api, ApiClientError } from "@/lib/api-client";

const BLOODS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

interface Registered { displayId: string; fullName: string; firstName: string; age: number | null; gender: string | null; bloodGroup: string | null; }
type Errs = Partial<Record<"firstName" | "phone" | "age" | "email", string>>;

const empty = {
  firstName: "", middleName: "", lastName: "", dob: "", age: "", gender: "FEMALE",
  blood: "O+", maritalStatus: "", phone: "", altPhone: "", email: "",
  address: "", city: "", state: "", country: "India", postalCode: "",
  occupation: "", nationality: "", preferredLanguage: "",
  emergencyName: "", emergencyRelation: "", emergencyPhone: "", allergies: "", govtId: "",
  referredByName: "", referralSource: "", isVip: false, remarks: "",
};

export default function RegisterPage() {
  const [f, setF] = useState({ ...empty });
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Errs>({});
  const [issued, setIssued] = useState<Registered | null>(null);

  const set = (k: keyof typeof empty) => (v: string | boolean) => {
    setF((p) => ({ ...p, [k]: v }));
    if (typeof k === "string" && k in errors) setErrors((p) => ({ ...p, [k]: undefined }));
  };

  // Age and DOB stay in sync: type an age -> DOB becomes 1 Jan of that birth
  // year; pick a DOB -> age is computed from it.
  function onAgeChange(v: string) {
    const age = v.replace(/\D/g, "").slice(0, 3);
    setF((p) => ({ ...p, age, dob: age !== "" ? `${new Date().getFullYear() - Number(age)}-01-01` : p.dob }));
    if ("age" in errors) setErrors((p) => ({ ...p, age: undefined }));
  }
  function onDobChange(v: string) {
    setF((p) => {
      const next = { ...p, dob: v };
      if (v) {
        const d = new Date(v);
        if (!Number.isNaN(d.getTime())) {
          const t = new Date();
          let a = t.getFullYear() - d.getFullYear();
          if (t.getMonth() < d.getMonth() || (t.getMonth() === d.getMonth() && t.getDate() < d.getDate())) a--;
          next.age = a >= 0 ? String(a) : "";
        }
      }
      return next;
    });
  }

  function validate(): boolean {
    const e: Errs = {};
    if (f.firstName.trim().length < 1) e.firstName = "First name is required";
    if (!/^\d{10}$/.test(f.phone)) e.phone = "Must be a 10-digit mobile number";
    if (f.age && (Number(f.age) < 0 || Number(f.age) > 120)) e.age = "Enter a valid age";
    if (f.email && !/^[^@]+@[^@]+\.[^@]+$/.test(f.email)) e.email = "Invalid email";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function submit() {
    setFormError(null);
    if (!validate()) return;
    setLoading(true);
    try {
      const { patient } = await api.post<{ patient: Registered }>("/reception/patients", {
        firstName: f.firstName.trim(), middleName: f.middleName || undefined, lastName: f.lastName || undefined,
        dob: f.dob || undefined, age: f.age ? Number(f.age) : undefined,
        gender: f.gender, bloodGroup: f.blood, maritalStatus: f.maritalStatus || undefined,
        phone: f.phone, alternatePhone: f.altPhone || undefined, email: f.email || undefined,
        address: f.address || undefined, city: f.city || undefined, state: f.state || undefined,
        country: f.country || undefined, postalCode: f.postalCode || undefined,
        occupation: f.occupation || undefined, nationality: f.nationality || undefined,
        preferredLanguage: f.preferredLanguage || undefined,
        emergencyContactName: f.emergencyName || undefined, emergencyContactRelation: f.emergencyRelation || undefined,
        emergencyContactPhone: f.emergencyPhone || undefined, allergies: f.allergies || undefined, govtIdNumber: f.govtId || undefined,
        referredByName: f.referredByName || undefined, referralSource: f.referralSource || undefined,
        isVip: f.isVip, remarks: f.remarks || undefined,
      });
      setIssued(patient);
    } catch (err) {
      setFormError(err instanceof ApiClientError ? err.message : "Could not register. Please try again.");
    } finally { setLoading(false); }
  }

  function registerAnother() { setIssued(null); setF({ ...empty }); setErrors({}); setFormError(null); }

  const fld = "w-full rounded-lg border bg-white px-3 py-2 text-sm text-[var(--p-ink)] outline-none transition-all duration-200 focus:ring-2 focus:ring-[var(--p-teal)]/15";
  const ok = "border-[var(--p-border)] focus:border-[var(--p-teal)]";
  const bad = "border-[var(--p-rose)] focus:border-[var(--p-rose)]";
  const cls = (e: unknown) => `${fld} ${e ? bad : ok}`;

  if (issued) {
    return (
      <div className="mx-auto max-w-md">
        <Card enter={0} className="flex flex-col items-center p-8 text-center">
          <SuccessCheck />
          <h3 className="mt-4 font-serif-p text-[22px] font-semibold text-[var(--p-ink)]">{issued.firstName} is registered</h3>
          <p className="mt-1 text-[14px] text-[var(--p-muted)]">Their permanent Jeeva ID has been issued and saved.</p>
          <div className="mt-5 rounded-xl bg-[var(--p-teal-soft)] px-6 py-3">
            <span className="font-mono text-lg tracking-wider text-[var(--p-teal-deep)]">{issued.displayId}</span>
          </div>
          <p className="mt-6 text-[13px] text-[var(--p-muted)]">Most patients book a consultation right away —</p>
          <div className="mt-3 flex flex-col gap-2.5 self-stretch">
            <a href={`/book?patient=${issued.displayId}`}
               className="inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--p-teal)] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--p-teal-deep)]">
              <Icon name="calendar" size={15} /> Book appointment for {issued.firstName} →
            </a>
            <div className="flex gap-2.5">
              <a href={`/patients/${issued.displayId}`}
                 className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-[var(--p-border)] px-4 py-2.5 text-[14px] font-medium text-[var(--p-text)] transition-colors hover:border-[var(--p-teal)] hover:text-[var(--p-teal)]">
                Open patient file
              </a>
              <button onClick={registerAnother}
                 className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-[var(--p-border)] px-4 py-2.5 text-[14px] font-medium text-[var(--p-text)] transition-colors hover:border-[var(--p-teal)] hover:text-[var(--p-teal)]">
                <Icon name="plus" size={14} /> Register another
              </button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl">
      <Card enter={0} className="dotgrid p-6">
        <div className="mb-5">
          <h3 className="text-[15px] font-semibold text-[var(--p-ink)]">Register new patient</h3>
          <p className="mt-1 text-[13px] leading-relaxed text-[var(--p-muted)]">A permanent Jeeva ID is issued and saved instantly. Only first name and phone are required.</p>
        </div>

        {formError && (
          <div data-enter className="mb-4 flex items-start gap-2 rounded-lg border border-[var(--p-rose)]/25 bg-[var(--p-rose-soft)] px-4 py-3 text-[14px] text-[var(--p-rose)]">
            <Icon name="alert" size={15} /> <span>{formError}</span>
          </div>
        )}

        <Sec>Name</Sec>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="First name" icon="users" error={errors.firstName}><input className={cls(errors.firstName)} value={f.firstName} onChange={(e) => set("firstName")(e.target.value)} placeholder="Divya" autoFocus /></Field>
          <Field label="Middle name"><input className={cls(false)} value={f.middleName} onChange={(e) => set("middleName")(e.target.value)} placeholder="—" /></Field>
          <Field label="Last name"><input className={cls(false)} value={f.lastName} onChange={(e) => set("lastName")(e.target.value)} placeholder="Prasad" /></Field>
        </div>

        <Sec>Demographics</Sec>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Date of birth"><input type="date" className={cls(false)} value={f.dob} onChange={(e) => onDobChange(e.target.value)} /></Field>
          <Field label="Age" error={errors.age}><input className={cls(errors.age)} value={f.age} onChange={(e) => onAgeChange(e.target.value)} inputMode="numeric" placeholder="29" /></Field>
          <Field label="Gender"><select className={cls(false)} value={f.gender} onChange={(e) => set("gender")(e.target.value)}><option value="FEMALE">Female</option><option value="MALE">Male</option><option value="OTHER">Other</option></select></Field>
          <Field label="Blood group"><select className={cls(false)} value={f.blood} onChange={(e) => set("blood")(e.target.value)}>{BLOODS.map((b) => <option key={b} value={b}>{b}</option>)}</select></Field>
          <Field label="Marital status"><select className={cls(false)} value={f.maritalStatus} onChange={(e) => set("maritalStatus")(e.target.value)}><option value="">—</option><option value="SINGLE">Single</option><option value="MARRIED">Married</option><option value="DIVORCED">Divorced</option><option value="WIDOWED">Widowed</option><option value="OTHER">Other</option></select></Field>
        </div>

        <Sec>Contact</Sec>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Phone" icon="clock" error={errors.phone}><input className={cls(errors.phone)} value={f.phone} onChange={(e) => set("phone")(e.target.value.replace(/\D/g, "").slice(0, 10))} inputMode="numeric" placeholder="9000012345" /></Field>
          <Field label="Alternate phone"><input className={cls(false)} value={f.altPhone} onChange={(e) => set("altPhone")(e.target.value.replace(/\D/g, "").slice(0, 10))} inputMode="numeric" placeholder="—" /></Field>
          <Field label="Email" error={errors.email} span><input className={cls(errors.email)} value={f.email} onChange={(e) => set("email")(e.target.value)} placeholder="name@example.com" /></Field>
          <Field label="Address" span><input className={cls(false)} value={f.address} onChange={(e) => set("address")(e.target.value)} placeholder="House no, area" /></Field>
          <Field label="City"><input className={cls(false)} value={f.city} onChange={(e) => set("city")(e.target.value)} placeholder="Hanamkonda" /></Field>
          <Field label="State"><input className={cls(false)} value={f.state} onChange={(e) => set("state")(e.target.value)} placeholder="Telangana" /></Field>
          <Field label="Country"><input className={cls(false)} value={f.country} onChange={(e) => set("country")(e.target.value)} /></Field>
          <Field label="PIN code"><input className={cls(false)} value={f.postalCode} onChange={(e) => set("postalCode")(e.target.value.replace(/\D/g, "").slice(0, 10))} inputMode="numeric" placeholder="506001" /></Field>
        </div>

        <Sec>Personal <span className="font-normal normal-case text-[var(--p-muted)]">· optional</span></Sec>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Occupation"><input className={cls(false)} value={f.occupation} onChange={(e) => set("occupation")(e.target.value)} placeholder="—" /></Field>
          <Field label="Nationality"><input className={cls(false)} value={f.nationality} onChange={(e) => set("nationality")(e.target.value)} placeholder="Indian" /></Field>
          <Field label="Preferred language"><input className={cls(false)} value={f.preferredLanguage} onChange={(e) => set("preferredLanguage")(e.target.value)} placeholder="Telugu" /></Field>
        </div>

        <Sec>Emergency &amp; medical <span className="font-normal normal-case text-[var(--p-muted)]">· optional</span></Sec>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Emergency contact name"><input className={cls(false)} value={f.emergencyName} onChange={(e) => set("emergencyName")(e.target.value)} placeholder="Ravi" /></Field>
          <Field label="Relationship"><input className={cls(false)} value={f.emergencyRelation} onChange={(e) => set("emergencyRelation")(e.target.value)} placeholder="Brother / spouse" /></Field>
          <Field label="Emergency phone"><input className={cls(false)} value={f.emergencyPhone} onChange={(e) => set("emergencyPhone")(e.target.value.replace(/\D/g, "").slice(0, 10))} inputMode="numeric" placeholder="9000012345" /></Field>
          <Field label="Known allergies" span><input className={cls(false)} value={f.allergies} onChange={(e) => set("allergies")(e.target.value)} placeholder="Penicillin, sulfa — or none" /></Field>
          <Field label="Govt ID (Aadhaar / ABHA)"><input className={cls(false)} value={f.govtId} onChange={(e) => set("govtId")(e.target.value)} placeholder="XXXX XXXX XXXX" /></Field>
        </div>

        <Sec>Referral <span className="font-normal normal-case text-[var(--p-muted)]">· admin-only · optional</span></Sec>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Referred by (doctor / clinic)" icon="stethoscope"><input className={cls(false)} value={f.referredByName} onChange={(e) => set("referredByName")(e.target.value)} placeholder="Dr. Anil, City Clinic" /></Field>
          <Field label="Referral source"><input className={cls(false)} value={f.referralSource} onChange={(e) => set("referralSource")(e.target.value)} placeholder="Camp / online / walk-in" /></Field>
        </div>

        <div className="mt-5 flex items-center gap-2">
          <input id="vip" type="checkbox" checked={f.isVip} onChange={(e) => set("isVip")(e.target.checked)} className="h-4 w-4 accent-[var(--p-teal)]" />
          <label htmlFor="vip" className="text-[14px] text-[var(--p-text)]">Mark as VIP patient</label>
        </div>

        <div className="mt-6">
          <PrimaryButton onClick={submit} disabled={loading}>
            {loading ? <><Spinner /> Registering…</> : <><Icon name="plus" size={15} /> Register patient</>}
          </PrimaryButton>
        </div>
      </Card>
    </div>
  );
}

function Sec({ children }: { children: React.ReactNode }) {
  return <p className="mb-3 mt-7 border-t border-[var(--p-border)] pt-5 text-[12px] font-semibold uppercase tracking-[0.08em] text-[var(--p-ink)] first:mt-0 first:border-0 first:pt-0">{children}</p>;
}
