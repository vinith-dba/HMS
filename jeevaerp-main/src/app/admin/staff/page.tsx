"use client";

import { useEffect, useState } from "react";
import { PrimaryButton, Pill } from "@/components/portal/ui/primitives";
import { Icon } from "@/components/portal/ui/icons";
import { Spinner, Field } from "@/components/portal/ui/form-atoms";
import { PortalScroll } from "@/components/portal/portal-scroll";
import { api, ApiClientError } from "@/lib/api-client";

interface Staff { id: string; username: string; name: string; email: string | null; phone: string; role: string; isActive: boolean; lastLoginAt: string | null; }
const ROLES = ["ADMIN", "RECEPTIONIST", "LAB_TECH", "PHARMACIST", "DOCTOR"] as const;
const PREFIX: Record<string, string> = { ADMIN: "admin", RECEPTIONIST: "reception", LAB_TECH: "labs", PHARMACIST: "pharmacy", DOCTOR: "doctor" };

export default function StaffPage() {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const [f, setF] = useState({ role: "RECEPTIONIST", handle: "", name: "", email: "", phone: "", password: "" });
  const username = f.handle ? `${PREFIX[f.role]}.${f.handle}` : "";

  async function load() {
    setLoading(true);
    try { const { staff } = await api.get<{ staff: Staff[] }>("/admin/staff"); setStaff(staff); }
    catch (e) { setError(e instanceof ApiClientError ? e.message : "Couldn't load staff."); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function create() {
    setBusy(true); setError(null);
    try {
      await api.post("/admin/staff", {
        username, name: f.name, email: f.email || undefined, phone: f.phone, role: f.role, password: f.password,
      });
      setOpen(false); setF({ role: "RECEPTIONIST", handle: "", name: "", email: "", phone: "", password: "" });
      await load();
    } catch (e) { setError(e instanceof ApiClientError ? e.message : "Could not create the account."); }
    finally { setBusy(false); }
  }

  async function toggle(u: Staff) {
    setError(null);
    try { await api.post("/admin/staff/active", { userId: u.id, isActive: !u.isActive }); await load(); }
    catch (e) { setError(e instanceof ApiClientError ? e.message : "Could not update."); }
  }

  const fld = "w-full rounded-lg border border-[var(--p-border)] bg-white px-3 py-2 text-sm text-[var(--p-ink)] outline-none focus:border-[var(--p-teal)]";

  return (
    <PortalScroll>
      <div data-rise className="surface dotgrid mb-6 flex flex-wrap items-center justify-between gap-4 px-6 py-5">
        <div>
          <h1 className="font-serif-p text-[22px] font-semibold text-[var(--p-ink)]">Staff</h1>
          <p className="mt-1 text-[13px] text-[var(--p-muted)]">Usernames are <span className="font-mono">role.name</span>. Staff sign in with a username + OTP (sent to their email) or password.</p>
        </div>
        <PrimaryButton onClick={() => setOpen(true)}><Icon name="plus" size={15} /> Add staff</PrimaryButton>
      </div>

      {error && <div data-rise className="mb-4 rounded-lg border border-[var(--p-rose)]/25 bg-[var(--p-rose-soft)] px-4 py-3 text-[13px] text-[var(--p-rose)]">{error}</div>}

      <section data-rise className="surface overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-[13px] text-[var(--p-muted)]"><Spinner /> Loading…</div>
        ) : (
          <div className="divide-y divide-[var(--p-border)]">
            {staff.map((u) => (
              <div key={u.id} className={`flex flex-wrap items-center justify-between gap-3 px-6 py-3.5 ${u.isActive ? "" : "opacity-55"}`}>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--p-teal-soft)] font-serif-p text-[12px] font-semibold text-[var(--p-teal)]">
                    {u.name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                  </div>
                  <div>
                    <div className="text-[14px] font-medium text-[var(--p-ink)]">{u.name}</div>
                    <div className="text-[12px] text-[var(--p-muted)]"><span className="font-mono">{u.username}</span>{u.email && ` · ${u.email}`}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="badge !text-[10px]">{u.role.replace("_", " ")}</span>
                  <Pill tone={u.isActive ? "completed" : "cancelled"}>{u.isActive ? "Active" : "Disabled"}</Pill>
                  <button onClick={() => toggle(u)} className="rounded-lg border border-[var(--p-border)] px-3 py-1.5 text-[12px] font-medium text-[var(--p-text)] hover:border-[var(--p-teal)] hover:text-[var(--p-teal)]">
                    {u.isActive ? "Disable" : "Enable"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="surface w-full max-w-md bg-white">
            <div className="border-b border-[var(--p-border)] px-6 py-4"><h3 className="text-[14px] font-semibold text-[var(--p-ink)]">Add staff member</h3></div>
            <div className="space-y-4 p-6">
              <Field label="Role">
                <select className={fld} value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}>
                  {ROLES.map((r) => <option key={r} value={r}>{r.replace("_", " ")}</option>)}
                </select>
              </Field>
              <Field label="Username">
                <div className="flex items-center gap-1.5">
                  <span className="rounded-lg bg-[var(--p-bg)] px-2.5 py-2 font-mono text-[13px] text-[var(--p-muted)]">{PREFIX[f.role]}.</span>
                  <input className={fld} value={f.handle} onChange={(e) => setF({ ...f, handle: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "") })} placeholder="ravi" />
                </div>
              </Field>
              <Field label="Full name"><input className={fld} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Ravi Kumar" /></Field>
              <Field label="Email (OTP is sent here)"><input className={fld} value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} placeholder="ravi@jeeva.local" /></Field>
              <Field label="Phone"><input className={fld} value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value.replace(/\D/g, "").slice(0, 10) })} placeholder="9000000002" /></Field>
              <Field label="Password (min 8 chars)"><input type="password" className={fld} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></Field>
              {username && <p className="rounded-lg bg-[var(--p-teal-soft)] px-3 py-2 font-mono text-[12px] text-[var(--p-teal-deep)]">Will sign in as: {username}</p>}
            </div>
            <div className="flex justify-end gap-3 border-t border-[var(--p-border)] p-5">
              <button onClick={() => setOpen(false)} className="rounded-lg border border-[var(--p-border)] px-4 py-2 text-sm text-[var(--p-text)]">Cancel</button>
              <PrimaryButton onClick={create} disabled={busy || !f.handle || !f.name || !f.phone || f.password.length < 8}>
                {busy ? <><Spinner /> Creating…</> : <><Icon name="check" size={15} /> Create</>}
              </PrimaryButton>
            </div>
          </div>
        </div>
      )}
    </PortalScroll>
  );
}
