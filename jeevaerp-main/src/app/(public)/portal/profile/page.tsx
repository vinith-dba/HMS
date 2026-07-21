"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";

interface Profile {
  displayId: string; fullName: string; dob: string | null; age: number | null;
  gender: string | null; bloodGroup: string | null; maritalStatus: string | null;
  phone: string; alternatePhone: string | null; email: string | null;
  address: string | null; city: string | null; state: string | null;
  country: string | null; postalCode: string | null; occupation: string | null;
  nationality: string | null; preferredLanguage: string | null; memberSince: string;
}
interface Appt { opNumber: string; visitDate: string; time: string; status: string; doctorName: string; department: string; price: string; }
interface Rx { id: string; fileUrl: string; fileName: string; mimeType: string; title: string | null; createdAt: string; appointment: { opNumber: string; visitDate: string; doctorName: string } | null; }

const LABEL: Record<string, string> = { BOOKED: "Booked", CHECKED_IN: "Checked-in", COMPLETED: "Completed", CANCELLED: "Cancelled" };

export default function PatientProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [appts, setAppts] = useState<Appt[]>([]);
  const [rx, setRx] = useState<Rx[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ phone: "", alternatePhone: "", email: "", address: "", city: "", state: "", postalCode: "" });

  useEffect(() => {
    api.get<{ profile: Profile; appointments: Appt[]; prescriptions: Rx[] }>("/portal/profile")
      .then((r) => {
        setProfile(r.profile); setAppts(r.appointments); setRx(r.prescriptions);
        setForm({
          phone: r.profile.phone ?? "", alternatePhone: r.profile.alternatePhone ?? "",
          email: r.profile.email ?? "", address: r.profile.address ?? "",
          city: r.profile.city ?? "", state: r.profile.state ?? "", postalCode: r.profile.postalCode ?? "",
        });
      })
      .catch(() => setError("Couldn't load your profile. Please sign in again."))
      .finally(() => setLoading(false));
  }, []);

  async function saveContact() {
    setSaving(true); setError(null);
    try {
      await api.patch("/portal/profile/contact", form);
      const r = await api.get<{ profile: Profile; appointments: Appt[]; prescriptions: Rx[] }>("/portal/profile");
      setProfile(r.profile); setEditing(false);
    } catch { setError("Couldn't save your details. Please try again."); }
    finally { setSaving(false); }
  }

  async function logout() {
    try { await api.post("/auth/logout"); } catch { /* ignore */ }
    window.location.assign("/portal/login");
  }

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-muted">Loading your profile…</div>;
  }
  if (error || !profile) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-5 text-center">
        <p className="text-sm text-muted">{error ?? "Profile unavailable."}</p>
        <a href="/portal/login" className="rounded-full bg-blue px-5 py-2.5 text-sm font-medium text-white">Sign in</a>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-blue-soft/40 pb-20 pt-24">
      <div className="container-x">
        {/* header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue font-display text-xl font-bold text-white">
              {profile.fullName.split(" ").map((n) => n[0]).slice(0, 2).join("")}
            </div>
            <div>
              <h1 className="font-display text-2xl font-semibold text-ink">{profile.fullName}</h1>
              <p className="mt-0.5 font-mono text-[13px] text-blue">{profile.displayId}</p>
            </div>
          </div>
          <button onClick={logout} className="rounded-full border border-line px-4 py-2 text-sm text-ink-soft transition-colors hover:border-blue hover:text-blue">
            Sign out
          </button>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_1.3fr]">
          {/* left: personal details */}
          <div className="space-y-6">
            <Panel title="Personal details">
              <Grid>
                <Item k="Full name" v={profile.fullName} />
                <Item k="Date of birth" v={profile.dob ?? "—"} />
                <Item k="Age" v={profile.age != null ? `${profile.age} years` : "—"} />
                <Item k="Gender" v={cap(profile.gender)} />
                <Item k="Blood group" v={profile.bloodGroup ?? "—"} />
                <Item k="Marital status" v={cap(profile.maritalStatus)} />
              </Grid>
            </Panel>

            <div className="rounded-2xl border border-line bg-white p-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-display text-lg font-semibold text-ink">Contact</h2>
                {!editing ? (
                  <button onClick={() => setEditing(true)} className="rounded-full border border-line px-3 py-1 text-[12px] font-medium text-blue hover:border-blue">Edit</button>
                ) : (
                  <div className="flex gap-2">
                    <button onClick={() => setEditing(false)} className="rounded-full border border-line px-3 py-1 text-[12px] text-muted">Cancel</button>
                    <button onClick={saveContact} disabled={saving} className="rounded-full bg-blue px-3 py-1 text-[12px] font-medium text-white disabled:opacity-60">
                      {saving ? "Saving…" : "Save"}
                    </button>
                  </div>
                )}
              </div>
              {!editing ? (
                <Grid>
                  <Item k="Phone" v={profile.phone} />
                  <Item k="Alternate" v={profile.alternatePhone ?? "—"} />
                  <Item k="Email" v={profile.email ?? "—"} span />
                  <Item k="Address" v={profile.address ?? "—"} span />
                  <Item k="City" v={profile.city ?? "—"} />
                  <Item k="State" v={profile.state ?? "—"} />
                  <Item k="Country" v={profile.country ?? "—"} />
                  <Item k="PIN" v={profile.postalCode ?? "—"} />
                </Grid>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <Edit k="Phone" v={form.phone} onChange={(v) => setForm({ ...form, phone: v.replace(/\D/g, "").slice(0, 10) })} />
                  <Edit k="Alternate" v={form.alternatePhone} onChange={(v) => setForm({ ...form, alternatePhone: v.replace(/\D/g, "").slice(0, 10) })} />
                  <Edit k="Email" v={form.email} onChange={(v) => setForm({ ...form, email: v })} span />
                  <Edit k="Address" v={form.address} onChange={(v) => setForm({ ...form, address: v })} span />
                  <Edit k="City" v={form.city} onChange={(v) => setForm({ ...form, city: v })} />
                  <Edit k="State" v={form.state} onChange={(v) => setForm({ ...form, state: v })} />
                  <Edit k="PIN" v={form.postalCode} onChange={(v) => setForm({ ...form, postalCode: v.replace(/\D/g, "").slice(0, 10) })} />
                </div>
              )}
            </div>

            <Panel title="Other">
              <Grid>
                <Item k="Occupation" v={profile.occupation ?? "—"} />
                <Item k="Nationality" v={profile.nationality ?? "—"} />
                <Item k="Language" v={profile.preferredLanguage ?? "—"} />
                <Item k="Member since" v={profile.memberSince} />
              </Grid>
            </Panel>
          </div>

          {/* right: prescriptions + appointments */}
          <div className="space-y-6">
            <Panel title="Prescriptions" count={rx.length}>
              {rx.length === 0 ? (
                <Empty text="No prescriptions yet. They'll appear here once uploaded by the hospital." />
              ) : (
                <div className="space-y-3">
                  {rx.map((r) => (
                    <div key={r.id} className="flex items-center justify-between gap-3 rounded-xl border border-line p-4">
                      <div className="flex items-center gap-3">
                        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-tint text-blue">
                          {r.mimeType === "application/pdf" ? "PDF" : "IMG"}
                        </span>
                        <div>
                          <p className="text-[14px] font-medium text-ink">{r.title || r.fileName}</p>
                          <p className="text-[12px] text-muted">
                            {r.appointment ? `${r.appointment.doctorName} · ${r.appointment.visitDate}` : new Date(r.createdAt).toLocaleDateString("en-IN")}
                          </p>
                        </div>
                      </div>
                      <a href={r.fileUrl} target="_blank" rel="noopener noreferrer" download
                        className="rounded-full bg-blue px-4 py-2 text-[12px] font-medium text-white transition-colors hover:bg-blue-deep">
                        Download
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </Panel>

            <Panel title="Appointments" count={appts.length}>
              {appts.length === 0 ? (
                <Empty text="No appointments yet." />
              ) : (
                <div className="space-y-3">
                  {appts.map((a) => (
                    <div key={a.opNumber} className="flex items-center justify-between gap-3 rounded-xl border border-line p-4">
                      <div>
                        <p className="text-[14px] font-medium text-ink">{a.doctorName}</p>
                        <p className="text-[12px] text-muted">{a.department} · <span className="font-mono">{a.visitDate}</span> · {a.time}</p>
                      </div>
                      <div className="text-right">
                        <span className="rounded-full bg-blue-tint px-3 py-1 text-[11px] font-semibold text-blue-deep">{LABEL[a.status] ?? a.status}</span>
                        <p className="mt-1 font-mono text-[12px] text-muted">₹{a.price}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          </div>
        </div>
      </div>
    </div>
  );
}

function cap(v: string | null) { return v ? v.charAt(0) + v.slice(1).toLowerCase() : "—"; }
function Panel({ title, count, children }: { title: string; count?: number; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-line bg-white p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold text-ink">{title}</h2>
        {count !== undefined && <span className="rounded-full bg-blue-tint px-2.5 py-0.5 text-[12px] font-semibold text-blue-deep">{count}</span>}
      </div>
      {children}
    </div>
  );
}
function Grid({ children }: { children: React.ReactNode }) { return <div className="grid grid-cols-2 gap-x-5 gap-y-4">{children}</div>; }
function Item({ k, v, span }: { k: string; v: string; span?: boolean }) {
  return (
    <div className={span ? "col-span-2" : ""}>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">{k}</p>
      <p className="mt-1 text-[14px] text-ink">{v}</p>
    </div>
  );
}
function Empty({ text }: { text: string }) { return <p className="py-6 text-center text-[13px] text-muted">{text}</p>; }
function Edit({ k, v, onChange, span }: { k: string; v: string; onChange: (v: string) => void; span?: boolean }) {
  return (
    <div className={span ? "col-span-2" : ""}>
      <label className="text-[11px] font-semibold uppercase tracking-wide text-muted">{k}</label>
      <input value={v} onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-[14px] text-ink outline-none focus:border-blue" />
    </div>
  );
}
