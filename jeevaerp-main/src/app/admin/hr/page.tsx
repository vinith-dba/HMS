"use client";

import { useEffect, useMemo, useState } from "react";
import { PrimaryButton } from "@/components/portal/ui/primitives";
import { Icon, type IconName } from "@/components/portal/ui/icons";
import { Spinner, Field } from "@/components/portal/ui/form-atoms";
import { PortalScroll } from "@/components/portal/portal-scroll";
import { api, ApiClientError } from "@/lib/api-client";

interface Staff {
  id: string; username: string; name: string; email: string | null; phone: string;
  role: string; isActive: boolean; lastLoginAt: string | null;
}

const ROLES = ["ADMIN", "RECEPTIONIST", "LAB_TECH", "PHARMACIST", "DOCTOR"] as const;
const ROLE_LABEL: Record<string, string> = { ADMIN: "Admin", RECEPTIONIST: "Reception", LAB_TECH: "Lab", PHARMACIST: "Pharmacy", DOCTOR: "Doctor" };
const PREFIX: Record<string, string> = { ADMIN: "admin", RECEPTIONIST: "reception", LAB_TECH: "labs", PHARMACIST: "pharmacy", DOCTOR: "doctor" };
const ROLE_ICON: Record<string, IconName> = { ADMIN: "building", RECEPTIONIST: "calendar", LAB_TECH: "flask", PHARMACIST: "pill", DOCTOR: "activity" };

const fmtLogin = (iso: string | null) => {
  if (!iso) return "never";
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) + ", " + d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
};

export default function HrPage() {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"ALL" | (typeof ROLES)[number]>("ALL");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({ role: "RECEPTIONIST", handle: "", name: "", email: "", phone: "", password: "" });

  const username = f.handle ? `${PREFIX[f.role]}.${f.handle.trim().toLowerCase()}` : "";

  async function load() {
    setLoading(true);
    try { const { staff } = await api.get<{ staff: Staff[] }>("/admin/staff"); setStaff(staff); setError(null); }
    catch (e) { setError(e instanceof ApiClientError ? e.message : "Couldn't load staff."); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function create() {
    setBusy(true); setError(null);
    try {
      await api.post("/admin/staff", { username, name: f.name, email: f.email || undefined, phone: f.phone, role: f.role, password: f.password });
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

  const counts = useMemo(() => {
    const c: Record<string, number> = {}; for (const r of ROLES) c[r] = 0;
    for (const s of staff) if (s.isActive) c[s.role] = (c[s.role] ?? 0) + 1;
    return c;
  }, [staff]);
  const activeCount = staff.filter((s) => s.isActive).length;

  const shown = useMemo(() => staff.filter((s) => {
    if (filter !== "ALL" && s.role !== filter) return false;
    if (q.trim()) { const t = q.toLowerCase(); return s.name.toLowerCase().includes(t) || s.username.toLowerCase().includes(t) || s.phone.includes(t); }
    return true;
  }), [staff, filter, q]);

  const fld = "w-full rounded-lg border border-[var(--p-border)] bg-white px-3 py-2 text-sm text-[var(--p-ink)] outline-none focus:border-[var(--p-teal)]";

  return (
    <PortalScroll>
      <div data-rise className="surface dotgrid mb-6 flex flex-wrap items-center justify-between gap-4 px-6 py-5">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--p-teal)]">Admin console</p>
          <h1 className="mt-1 font-serif-p text-[24px] font-semibold text-[var(--p-ink)]">HR &amp; staff</h1>
          <p className="mt-1 text-[13px] text-[var(--p-muted)]">Headcount, accounts and access. Usernames are <span className="font-mono">role.name</span>; staff sign in with username + OTP or password.</p>
        </div>
        <PrimaryButton onClick={() => setOpen(true)}><Icon name="plus" size={15} /> Add staff</PrimaryButton>
      </div>

      {error && <div className="mb-4 rounded-lg border border-[var(--p-rose)]/25 bg-[var(--p-rose-soft)] px-4 py-3 text-[13px] text-[var(--p-rose)]">{error}</div>}

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-20 text-[13px] text-[var(--p-muted)]"><Spinner /> Loading…</div>
      ) : (
        <>
          {/* Headcount */}
          <div data-rise className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
            <div className="surface px-5 py-4">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--p-muted)]">Active staff</div>
              <div className="mt-1 font-mono text-[21px] font-bold text-[var(--p-teal)]">{activeCount}</div>
              <div className="mt-0.5 text-[12px] text-[var(--p-muted)]">{staff.length} total accounts</div>
            </div>
            {ROLES.map((r) => (
              <div key={r} className="surface px-5 py-4">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--p-muted)]"><Icon name={ROLE_ICON[r]} size={13} /> {ROLE_LABEL[r]}</div>
                <div className="mt-1 font-mono text-[21px] font-bold text-[var(--p-ink)]">{counts[r]}</div>
              </div>
            ))}
          </div>

          {/* Filters */}
          <div data-rise className="mb-4 flex flex-wrap items-center gap-2">
            <div className="flex flex-wrap gap-1.5">
              {(["ALL", ...ROLES] as const).map((r) => (
                <button key={r} onClick={() => setFilter(r)}
                  className={`rounded-lg border px-3 py-1.5 text-[12px] font-semibold ${filter === r ? "border-[var(--p-teal)] bg-[var(--p-teal)] text-white" : "border-[var(--p-border)] text-[var(--p-muted)]"}`}>
                  {r === "ALL" ? "All" : ROLE_LABEL[r]}
                </button>
              ))}
            </div>
            <div className="ml-auto flex items-center gap-2 rounded-lg border border-[var(--p-border)] bg-white px-3 py-1.5">
              <Icon name="search" size={14} />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, username, phone" className="w-56 bg-transparent text-[13px] text-[var(--p-ink)] outline-none" />
            </div>
          </div>

          {/* Directory */}
          <section data-rise className="surface overflow-hidden">
            <div className="divide-y divide-[var(--p-border)]">
              {shown.length === 0 ? (
                <p className="px-6 py-10 text-center text-[13px] text-[var(--p-muted)]">No staff match.</p>
              ) : shown.map((u) => (
                <div key={u.id} className="flex flex-wrap items-center gap-3 px-6 py-3.5">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--p-teal-soft)] text-[12px] font-bold text-[var(--p-teal-deep)]">
                      {u.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-[14px] font-medium text-[var(--p-ink)]">{u.name}</span>
                        <span className="rounded bg-[var(--p-border)]/40 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-[var(--p-muted)]">{ROLE_LABEL[u.role] ?? u.role}</span>
                      </div>
                      <div className="truncate font-mono text-[12px] text-[var(--p-muted)]">{u.username} · {u.phone}{u.email ? ` · ${u.email}` : ""}</div>
                    </div>
                  </div>
                  <div className="text-right text-[11px] text-[var(--p-muted)]">
                    <div>Last sign-in</div>
                    <div className="text-[var(--p-ink)]">{fmtLogin(u.lastLoginAt)}</div>
                  </div>
                  <button onClick={() => toggle(u)}
                    className={`rounded-lg border px-3 py-1.5 text-[12px] font-semibold ${u.isActive ? "border-[var(--p-teal)]/40 text-[var(--p-teal-deep)]" : "border-[var(--p-rose)]/40 text-[var(--p-rose)]"}`}>
                    {u.isActive ? "Active" : "Inactive"}
                  </button>
                </div>
              ))}
            </div>
          </section>
        </>
      )}

      {/* Add staff modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={() => !busy && setOpen(false)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-serif-p text-[18px] font-semibold text-[var(--p-ink)]">Add staff</h2>
            <p className="mt-1 text-[12px] text-[var(--p-muted)]">Username becomes <span className="font-mono">{username || `${PREFIX[f.role]}.name`}</span>.</p>
            <div className="mt-4 space-y-3">
              <Field label="Role">
                <div className="flex flex-wrap gap-1.5">
                  {ROLES.map((r) => (
                    <button key={r} onClick={() => setF({ ...f, role: r })}
                      className={`rounded-lg border px-3 py-1.5 text-[12px] font-semibold ${f.role === r ? "border-[var(--p-teal)] bg-[var(--p-teal)] text-white" : "border-[var(--p-border)] text-[var(--p-muted)]"}`}>{ROLE_LABEL[r]}</button>
                  ))}
                </div>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Handle"><input className={fld} value={f.handle} onChange={(e) => setF({ ...f, handle: e.target.value })} placeholder="ravi" /></Field>
                <Field label="Full name"><input className={fld} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Ravi Kumar" /></Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Phone"><input className={fld} value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value.replace(/\D/g, "").slice(0, 10) })} inputMode="numeric" placeholder="10 digits" /></Field>
                <Field label="Email (optional)"><input className={fld} value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} placeholder="name@hospital.in" /></Field>
              </div>
              <Field label="Temporary password"><input className={fld} type="text" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} placeholder="min 8 characters" /></Field>
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button onClick={() => setOpen(false)} disabled={busy} className="rounded-lg border border-[var(--p-border)] px-4 py-2 text-sm font-medium text-[var(--p-text)] disabled:opacity-40">Cancel</button>
              <PrimaryButton onClick={create} disabled={busy || !f.handle || f.name.length < 2 || f.phone.length !== 10 || f.password.length < 8}>
                {busy ? <><Spinner /> Creating…</> : <><Icon name="check" size={15} /> Create account</>}
              </PrimaryButton>
            </div>
          </div>
        </div>
      )}
    </PortalScroll>
  );
}
