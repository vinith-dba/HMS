"use client";

import { useEffect, useState } from "react";
import { PrimaryButton } from "@/components/portal/ui/primitives";
import { Icon } from "@/components/portal/ui/icons";
import { Spinner, Field } from "@/components/portal/ui/form-atoms";
import { PortalScroll } from "@/components/portal/portal-scroll";
import { api, ApiClientError } from "@/lib/api-client";

const blank = { legalName: "", addressLine: "", city: "", state: "", stateCode: "36", pincode: "", gstin: "", phone: "", email: "" };

export default function SettingsPage() {
  const [f, setF] = useState({ ...blank });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<{ config: typeof blank | null }>("/admin/config")
      .then((r) => { if (r.config) setF({ ...blank, ...r.config }); })
      .catch(() => {}).finally(() => setLoading(false));
  }, []);

  async function save() {
    setSaving(true); setError(null); setMsg(null);
    try {
      await api.put("/admin/config", f);
      setMsg("Saved. This appears on every GST invoice.");
    } catch (e) { setError(e instanceof ApiClientError ? e.message : "Could not save."); }
    finally { setSaving(false); }
  }

  const fld = "w-full rounded-lg border border-[var(--p-border)] bg-white px-3 py-2 text-sm text-[var(--p-ink)] outline-none focus:border-[var(--p-teal)]";
  const set = (k: keyof typeof blank) => (v: string) => setF((p) => ({ ...p, [k]: v }));

  if (loading) return <div className="flex items-center justify-center gap-2 py-20 text-[13px] text-[var(--p-muted)]"><Spinner /> Loading…</div>;

  return (
    <PortalScroll>
      <div data-rise className="surface dotgrid mb-6 px-6 py-5">
        <h1 className="font-serif-p text-[22px] font-semibold text-[var(--p-ink)]">Hospital settings</h1>
        <p className="mt-1 text-[13px] text-[var(--p-muted)]">These details print on every GST invoice. The GSTIN must be the hospital&apos;s real registration number.</p>
      </div>

      <section data-rise className="surface mx-auto max-w-2xl overflow-hidden">
        <div className="grid gap-4 p-6 sm:grid-cols-2">
          <Field label="Legal name" span><input className={fld} value={f.legalName} onChange={(e) => set("legalName")(e.target.value)} /></Field>
          <Field label="Address" span><input className={fld} value={f.addressLine} onChange={(e) => set("addressLine")(e.target.value)} /></Field>
          <Field label="City"><input className={fld} value={f.city} onChange={(e) => set("city")(e.target.value)} /></Field>
          <Field label="State"><input className={fld} value={f.state} onChange={(e) => set("state")(e.target.value)} /></Field>
          <Field label="State code (Telangana = 36)"><input className={fld} value={f.stateCode} onChange={(e) => set("stateCode")(e.target.value.replace(/\D/g, "").slice(0, 2))} /></Field>
          <Field label="PIN code"><input className={fld} value={f.pincode} onChange={(e) => set("pincode")(e.target.value.replace(/\D/g, "").slice(0, 6))} /></Field>
          <Field label="GSTIN" span><input className={`${fld} font-mono`} value={f.gstin} onChange={(e) => set("gstin")(e.target.value.toUpperCase())} placeholder="36AACCA1234F1Z5" /></Field>
          <Field label="Phone"><input className={fld} value={f.phone} onChange={(e) => set("phone")(e.target.value)} /></Field>
          <Field label="Email"><input className={fld} value={f.email} onChange={(e) => set("email")(e.target.value)} /></Field>
        </div>
        {msg && <p className="mx-6 mb-4 rounded-lg bg-[var(--p-teal-soft)] px-4 py-2.5 text-[13px] text-[var(--p-teal-deep)]">{msg}</p>}
        {error && <p className="mx-6 mb-4 rounded-lg bg-[var(--p-rose-soft)] px-4 py-2.5 text-[13px] text-[var(--p-rose)]">{error}</p>}
        <div className="border-t border-[var(--p-border)] p-5">
          <PrimaryButton onClick={save} disabled={saving}>{saving ? <><Spinner /> Saving…</> : <><Icon name="check" size={15} /> Save settings</>}</PrimaryButton>
        </div>
      </section>
    </PortalScroll>
  );
}
