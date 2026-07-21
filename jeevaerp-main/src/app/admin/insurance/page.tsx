"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "@/components/portal/ui/icons";
import { Spinner } from "@/components/portal/ui/form-atoms";
import { PortalScroll } from "@/components/portal/portal-scroll";
import { api, ApiClientError } from "@/lib/api-client";

interface Claim {
  id: string; claimNo: string;
  patient: { id: string; displayId: string; fullName: string; phone?: string; age?: number | null };
  insurer: string; policyNo: string; type: string; stage: string; status: string;
  claimedAmount: string; approvedAmount: string | null; settledAmount: string | null;
  insurerRef: string | null; createdAt: string; submittedAt: string | null; updatedAt: string;
}
interface ClaimDetail extends Claim {
  memberId: string | null; sumInsured: string | null; diagnosis: string | null; remarks: string | null;
  admissionId: string | null; invoiceId: string | null; decisionAt: string | null; settledAt: string | null;
  events: { kind: string; detail: string | null; amount: string | null; by: string; at: string }[];
}
interface Stats {
  counts: { draft: number; withInsurer: number; approved: number; settled: number; rejected: number };
  totalClaimed: string; totalApproved: string; totalSettled: string; pendingSettlement: string;
}
interface PatientHit { id: string; displayId: string; fullName: string; phone: string; age: number | null }

const inr = (s: string | number | null) => (s == null ? "—" : "₹" + Number(s).toLocaleString("en-IN", { maximumFractionDigits: 0 }));
const inr2 = (s: string | number | null) => (s == null ? "—" : "₹" + Number(s).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const when = (iso: string) => new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

const STATUS: Record<string, { label: string; cls: string }> = {
  DRAFT: { label: "Draft", cls: "bg-[var(--p-border)]/50 text-[var(--p-muted)]" },
  SUBMITTED: { label: "With insurer", cls: "bg-[var(--p-blue-soft)] text-[var(--p-blue-deep)]" },
  QUERIED: { label: "Queried", cls: "bg-[var(--p-amber-soft)] text-[#8a5a14]" },
  APPROVED: { label: "Approved", cls: "bg-[var(--p-cyan-soft)] text-[var(--p-cyan-deep)]" },
  PARTIALLY_APPROVED: { label: "Part-approved", cls: "bg-[var(--p-cyan-soft)] text-[var(--p-cyan-deep)]" },
  REJECTED: { label: "Rejected", cls: "bg-[var(--p-rose-soft)] text-[var(--p-rose)]" },
  SETTLED: { label: "Settled", cls: "bg-[var(--p-cyan-soft)] text-[var(--p-cyan-deep)]" },
  CLOSED: { label: "Closed", cls: "bg-[var(--p-border)]/50 text-[var(--p-muted)]" },
};
const StatusPill = ({ s }: { s: string }) => {
  const m = STATUS[s] ?? { label: s, cls: "bg-[var(--p-border)]/50 text-[var(--p-muted)]" };
  return <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${m.cls}`}>{m.label}</span>;
};

const TABS = [
  { k: "ALL", label: "All" },
  { k: "DRAFT", label: "Draft" },
  { k: "WITH_INSURER", label: "With insurer" },
  { k: "APPROVED", label: "Approved" },
  { k: "SETTLED", label: "Settled" },
  { k: "REJECTED", label: "Rejected" },
];

function availableActions(status: string): { a: string; label: string; tone?: "primary" | "danger" }[] {
  switch (status) {
    case "DRAFT": return [{ a: "SUBMIT", label: "Submit to insurer", tone: "primary" }, { a: "NOTE", label: "Add note" }];
    case "SUBMITTED": return [{ a: "APPROVE", label: "Record approval", tone: "primary" }, { a: "QUERY", label: "Insurer queried" }, { a: "REJECT", label: "Rejected", tone: "danger" }, { a: "NOTE", label: "Add note" }];
    case "QUERIED": return [{ a: "SUBMIT", label: "Re-submit", tone: "primary" }, { a: "APPROVE", label: "Record approval" }, { a: "REJECT", label: "Rejected", tone: "danger" }, { a: "NOTE", label: "Add note" }];
    case "APPROVED": case "PARTIALLY_APPROVED": return [{ a: "SETTLE", label: "Record settlement", tone: "primary" }, { a: "NOTE", label: "Add note" }];
    default: return [{ a: "NOTE", label: "Add note" }];
  }
}

export default function InsurancePage() {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [insurers, setInsurers] = useState<string[]>([]);
  const [tab, setTab] = useState("ALL");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [detail, setDetail] = useState<ClaimDetail | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get<{ claims: Claim[]; stats: Stats; insurers: string[] }>(`/admin/insurance?status=${tab}${q ? `&q=${encodeURIComponent(q)}` : ""}`);
      setClaims(r.claims); setStats(r.stats); setInsurers(r.insurers);
    } catch (e) { setError(e instanceof ApiClientError ? e.message : "Couldn't load claims."); }
    finally { setLoading(false); }
  }, [tab, q]);
  useEffect(() => { const t = setTimeout(load, q ? 250 : 0); return () => clearTimeout(t); }, [load, q]);

  return (
    <PortalScroll>
      {/* header shell */}
      <div data-rise className="relative mb-6 rounded-[24px] bg-[#0b201d] px-7 py-7 pb-16 text-white sm:px-9">
        <p className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-[#7fcab8]">Insurance desk</p>
        <h1 className="mt-2 font-serif-p text-[clamp(24px,3vw,32px)] font-semibold">Cashless &amp; reimbursement claims</h1>
        <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-white/60">
          Raise a claim against a patient&apos;s treatment, submit it to the insurer or TPA, and track it
          through approval and settlement — every step on one timeline, without leaving the ERP.
        </p>
        {stats && (
          <div className="mt-5 flex flex-wrap gap-2">
            <span className="rounded-full bg-white/10 px-3.5 py-1.5 font-mono text-[11.5px] text-white/85">{stats.counts.draft} drafts</span>
            <span className="rounded-full bg-white/10 px-3.5 py-1.5 font-mono text-[11.5px] text-white/85">{stats.counts.withInsurer} with insurer</span>
            <span className="rounded-full bg-white/10 px-3.5 py-1.5 font-mono text-[11.5px] text-white/85">{stats.counts.approved} approved</span>
            <span className="rounded-full bg-[#f59e0b]/20 px-3.5 py-1.5 font-mono text-[11.5px] text-[#ffd08a]">{inr(stats.pendingSettlement)} awaiting money</span>
          </div>
        )}
        <div className="scoop scoop-br">
          <button onClick={() => setCreating(true)} className="btn-primary inline-flex items-center gap-2 rounded-md px-6 py-3 text-[13px] font-semibold text-white">
            <Icon name="plus" size={14} /> New claim
          </button>
        </div>
      </div>

      {flash && <div className="mb-4 rounded-lg border border-[var(--p-cyan)]/30 bg-[var(--p-cyan-soft)] px-4 py-2.5 text-[13px] font-medium text-[var(--p-cyan-deep)]">{flash}</div>}
      {error && <div className="mb-4 rounded-lg border border-[var(--p-rose)]/25 bg-[var(--p-rose-soft)] px-4 py-2.5 text-[13px] text-[var(--p-rose)]">{error}</div>}

      {/* money KPIs */}
      {stats && (
        <div data-rise className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi label="Total claimed" value={inr(stats.totalClaimed)} sub="all claims raised" />
          <Kpi label="Approved" value={inr(stats.totalApproved)} sub={`${stats.counts.approved + stats.counts.settled} claims`} />
          <Kpi label="Settled" value={inr(stats.totalSettled)} sub={`${stats.counts.settled} paid`} />
          <Kpi label="Awaiting settlement" value={inr(stats.pendingSettlement)} sub="approved, not yet received" accent />
        </div>
      )}

      {/* filters */}
      <div data-rise className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1 rounded-md border border-[var(--p-border)] bg-white p-1">
          {TABS.map((t) => (
            <button key={t.k} onClick={() => setTab(t.k)}
              className={`rounded px-3.5 py-1.5 text-[12px] font-semibold transition-colors ${tab === t.k ? "bg-[var(--p-blue)] text-white" : "text-[var(--p-muted)] hover:text-[var(--p-ink)]"}`}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 rounded-md border border-[var(--p-border)] bg-white px-3 py-2">
          <Icon name="search" size={15} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Claim no, patient, insurer, policy…" className="w-56 text-sm outline-none" />
        </div>
      </div>

      {/* list */}
      <section data-rise className="surface overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-[13px] text-[var(--p-muted)]"><Spinner /> Loading…</div>
        ) : claims.length === 0 ? (
          <div className="py-16 text-center text-[13px] text-[var(--p-muted)]">No claims here yet. Raise one with <b>New claim</b>.</div>
        ) : (
          <div className="divide-y divide-[var(--p-border)]">
            {claims.map((c) => (
              <button key={c.id} onClick={() => setDetail(c as ClaimDetail)}
                className="flex w-full flex-wrap items-center justify-between gap-3 px-6 py-4 text-left transition-colors hover:bg-[var(--p-bg)]">
                <div className="flex min-w-0 items-center gap-4">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[var(--p-blue-soft)] text-[var(--p-blue)]"><Icon name="shield" size={18} /></span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[12.5px] font-semibold text-[var(--p-ink)]">{c.claimNo}</span>
                      <StatusPill s={c.status} />
                    </div>
                    <div className="truncate text-[13px] text-[var(--p-ink)]">{c.patient.fullName} <span className="text-[var(--p-muted)]">· {c.insurer} · {c.type === "CASHLESS" ? "Cashless" : "Reimbursement"}</span></div>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-6">
                  <div className="text-right">
                    <div className="font-mono text-[14px] font-semibold text-[var(--p-ink)]">{inr(c.claimedAmount)}</div>
                    <div className="text-[11px] text-[var(--p-muted)]">
                      {c.settledAmount ? `settled ${inr(c.settledAmount)}` : c.approvedAmount ? `approved ${inr(c.approvedAmount)}` : "claimed"}
                    </div>
                  </div>
                  <Icon name="chevron" size={16} />
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      {creating && <NewClaim insurers={insurers} onClose={() => setCreating(false)} onCreated={(c) => { setCreating(false); setFlash(`Claim ${c.claimNo} raised for ${c.patient.fullName}.`); setDetail(c); load(); }} />}
      {detail && <ClaimModal claim={detail} onClose={() => setDetail(null)} onChanged={(msg) => { setFlash(msg); load(); }} />}
    </PortalScroll>
  );
}

function Kpi({ label, value, sub, accent }: { label: string; value: string; sub: string; accent?: boolean }) {
  return (
    <div className={`surface px-5 py-4 ${accent ? "!bg-[#0b201d] text-white" : ""}`}>
      <div className={`text-[11px] font-semibold uppercase tracking-wide ${accent ? "text-white/60" : "text-[var(--p-muted)]"}`}>{label}</div>
      <div className={`mt-1 font-mono text-[22px] font-bold ${accent ? "text-white" : "text-[var(--p-ink)]"}`}>{value}</div>
      <div className={`mt-0.5 text-[11px] ${accent ? "text-white/45" : "text-[var(--p-muted)]"}`}>{sub}</div>
    </div>
  );
}

/* ---- new claim ---------------------------------------------------------- */
function NewClaim({ insurers, onClose, onCreated }: { insurers: string[]; onClose: () => void; onCreated: (c: ClaimDetail) => void }) {
  const [patient, setPatient] = useState<PatientHit | null>(null);
  const [pq, setPq] = useState("");
  const [hits, setHits] = useState<PatientHit[]>([]);
  const [f, setF] = useState({ insurer: "", policyNo: "", memberId: "", sumInsured: "", type: "CASHLESS", stage: "PRE_AUTH", diagnosis: "", claimedAmount: "", remarks: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (v: string) => setF((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    if (patient || !pq.trim()) { setHits([]); return; }
    const t = setTimeout(async () => {
      try { const r = await api.get<{ patients: PatientHit[] }>(`/admin/insurance/patients?q=${encodeURIComponent(pq)}`); setHits(r.patients); } catch { setHits([]); }
    }, 250);
    return () => clearTimeout(t);
  }, [pq, patient]);

  const ready = patient && f.insurer.trim() && f.policyNo.trim() && Number(f.claimedAmount) >= 1;
  async function submit() {
    if (!ready) return;
    setBusy(true); setErr(null);
    try {
      const { claim } = await api.post<{ claim: ClaimDetail }>("/admin/insurance", {
        patientId: patient!.id, insurer: f.insurer.trim(), policyNo: f.policyNo.trim(),
        memberId: f.memberId.trim() || undefined, sumInsured: f.sumInsured ? Number(f.sumInsured) : undefined,
        type: f.type, stage: f.stage, diagnosis: f.diagnosis.trim() || undefined,
        claimedAmount: Number(f.claimedAmount), remarks: f.remarks.trim() || undefined,
      });
      onCreated(claim);
    } catch (e) { setErr(e instanceof ApiClientError ? e.message : "Couldn't raise the claim."); }
    finally { setBusy(false); }
  }

  const inp = "w-full rounded-md border border-[var(--p-border)] bg-white px-3 py-2 text-sm text-[var(--p-ink)] outline-none focus:border-[var(--p-blue)]";
  const lbl = "mb-1 block text-[11px] font-semibold uppercase tracking-[0.05em] text-[var(--p-muted)]";

  return (
    <div className="clm-veil" onClick={onClose}>
      <div className="clm-sheet flex max-h-[94vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-[var(--p-border)] px-6 py-4">
          <h3 className="text-[15px] font-semibold text-[var(--p-ink)]">Raise a new claim</h3>
          <button onClick={onClose} className="text-[var(--p-muted)] hover:text-[var(--p-ink)]">✕</button>
        </div>
        <div className="flex-1 space-y-5 overflow-y-auto p-6">
          {/* patient */}
          <div>
            <p className={lbl}>Patient</p>
            {patient ? (
              <div className="flex items-center justify-between rounded-lg border border-[var(--p-blue)] bg-[var(--p-blue-soft)] px-4 py-2.5">
                <span className="text-[13.5px] font-medium text-[var(--p-ink)]">{patient.fullName} <span className="font-mono text-[12px] text-[var(--p-muted)]">· {patient.displayId}</span></span>
                <button onClick={() => setPatient(null)} className="text-[12px] font-semibold text-[var(--p-blue)]">Change</button>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 rounded-md border border-[var(--p-border)] px-3 py-2"><Icon name="search" size={15} /><input value={pq} onChange={(e) => setPq(e.target.value)} placeholder="Name, Jeeva ID or phone…" className="w-full text-sm outline-none" autoFocus /></div>
                {hits.length > 0 && (
                  <div className="mt-2 space-y-1.5">
                    {hits.map((h) => (
                      <button key={h.id} onClick={() => { setPatient(h); setPq(""); }} className="flex w-full items-center justify-between rounded-lg border border-[var(--p-border)] p-2.5 text-left hover:border-[var(--p-blue)]">
                        <span className="text-[13px] font-medium text-[var(--p-ink)]">{h.fullName}</span>
                        <span className="font-mono text-[11px] text-[var(--p-muted)]">{h.displayId} · {h.phone}</span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div><label className={lbl}>Insurer / TPA</label><input list="insurers" className={inp} value={f.insurer} onChange={(e) => set("insurer")(e.target.value)} placeholder="Star Health / Medi Assist…" /><datalist id="insurers">{insurers.map((x) => <option key={x} value={x} />)}</datalist></div>
            <div><label className={lbl}>Policy number</label><input className={inp} value={f.policyNo} onChange={(e) => set("policyNo")(e.target.value)} placeholder="P/1234/5678" /></div>
            <div><label className={lbl}>Member ID</label><input className={inp} value={f.memberId} onChange={(e) => set("memberId")(e.target.value)} placeholder="Optional" /></div>
            <div><label className={lbl}>Sum insured (₹)</label><input className={inp} inputMode="numeric" value={f.sumInsured} onChange={(e) => set("sumInsured")(e.target.value.replace(/[^\d]/g, ""))} placeholder="500000" /></div>
            <div>
              <label className={lbl}>Claim type</label>
              <select className={inp} value={f.type} onChange={(e) => set("type")(e.target.value)}><option value="CASHLESS">Cashless</option><option value="REIMBURSEMENT">Reimbursement</option></select>
            </div>
            <div>
              <label className={lbl}>Stage</label>
              <select className={inp} value={f.stage} onChange={(e) => set("stage")(e.target.value)}><option value="PRE_AUTH">Pre-authorization</option><option value="FINAL">Final claim</option></select>
            </div>
            <div className="sm:col-span-2"><label className={lbl}>Diagnosis</label><input className={inp} value={f.diagnosis} onChange={(e) => set("diagnosis")(e.target.value)} placeholder="e.g. Acute appendicitis — laparoscopic appendectomy" /></div>
            <div><label className={lbl}>Amount claimed (₹)</label><input className={inp} inputMode="numeric" value={f.claimedAmount} onChange={(e) => set("claimedAmount")(e.target.value.replace(/[^\d]/g, ""))} placeholder="45000" /></div>
            <div className="sm:col-span-2"><label className={lbl}>Remarks</label><input className={inp} value={f.remarks} onChange={(e) => set("remarks")(e.target.value)} placeholder="Optional" /></div>
          </div>
          {err && <p className="rounded-lg border border-[var(--p-rose)]/25 bg-[var(--p-rose-soft)] px-4 py-2.5 text-[12.5px] text-[var(--p-rose)]">{err}</p>}
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-[var(--p-border)] px-6 py-4">
          <p className="text-[12px] text-[var(--p-muted)]">The claim starts as a draft — submit it to the insurer from its page.</p>
          <div className="flex gap-2">
            <button onClick={onClose} className="rounded-md border border-[var(--p-border)] px-4 py-2.5 text-[13px] font-medium text-[var(--p-text)]">Cancel</button>
            <button onClick={submit} disabled={!ready || busy} className="btn-primary inline-flex items-center gap-2 rounded-md px-5 py-2.5 text-[13px] font-semibold text-white disabled:opacity-40">
              {busy ? <><Spinner size={14} /> Saving…</> : <><Icon name="check" size={15} /> Raise claim</>}
            </button>
          </div>
        </div>
      </div>
      <style jsx>{`
        .clm-veil { position: fixed; inset: 0; z-index: 60; display: flex; align-items: center; justify-content: center; padding: 16px; background: rgba(12,26,28,0.5); backdrop-filter: blur(2px); }
        .clm-sheet { box-shadow: 0 30px 70px -20px rgba(12,26,28,0.5); animation: cin .22s cubic-bezier(.22,.68,.28,1) both; }
        @keyframes cin { from { opacity: 0; transform: translateY(10px) scale(.99); } to { opacity: 1; transform: none; } }
        @media (prefers-reduced-motion: reduce) { .clm-sheet { animation: none; } }
      `}</style>
    </div>
  );
}

/* ---- claim detail + lifecycle ------------------------------------------- */
function ClaimModal({ claim, onClose, onChanged }: { claim: Claim; onClose: () => void; onChanged: (msg: string) => void }) {
  const [c, setC] = useState<ClaimDetail | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [form, setForm] = useState<{ action: string; amount: string; insurerRef: string; detail: string } | null>(null);
  const firstLoad = useRef(true);

  const refresh = useCallback(async () => {
    try { const r = await api.get<{ claim: ClaimDetail }>(`/admin/insurance/${claim.id}`); setC(r.claim); }
    catch (e) { setErr(e instanceof ApiClientError ? e.message : "Couldn't load the claim."); }
  }, [claim.id]);
  useEffect(() => { refresh(); }, [refresh]);

  function startAction(a: string) {
    setErr(null);
    setForm({ action: a, amount: a === "APPROVE" ? (c?.claimedAmount ?? "") : a === "SETTLE" ? (c?.approvedAmount ?? "") : "", insurerRef: c?.insurerRef ?? "", detail: "" });
  }
  async function confirm() {
    if (!form) return;
    setBusy(true); setErr(null);
    try {
      await api.post(`/admin/insurance/${claim.id}/action`, {
        action: form.action,
        ...((form.action === "APPROVE" || form.action === "SETTLE") && form.amount ? { amount: Number(form.amount) } : {}),
        ...(form.insurerRef.trim() ? { insurerRef: form.insurerRef.trim() } : {}),
        ...(form.detail.trim() ? { detail: form.detail.trim() } : {}),
      });
      setForm(null); await refresh();
      onChanged(actionMsg(form.action));
    } catch (e) { setErr(e instanceof ApiClientError ? e.message : "Action failed."); }
    finally { setBusy(false); }
  }
  useEffect(() => { firstLoad.current = false; }, []);

  const inp = "w-full rounded-md border border-[var(--p-border)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--p-blue)]";

  return (
    <div className="clm-veil" onClick={onClose}>
      <div className="clm-sheet flex max-h-[94vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 border-b border-[var(--p-border)] px-6 py-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-mono text-[14px] font-semibold text-[var(--p-ink)]">{claim.claimNo}</h3>
              {c && <StatusPill s={c.status} />}
            </div>
            <p className="mt-0.5 text-[12.5px] text-[var(--p-muted)]">{claim.patient.fullName} · {claim.insurer} · {claim.type === "CASHLESS" ? "Cashless" : "Reimbursement"} · {claim.stage === "PRE_AUTH" ? "Pre-auth" : "Final"}</p>
          </div>
          <button onClick={onClose} className="text-[var(--p-muted)] hover:text-[var(--p-ink)]">✕</button>
        </div>

        {!c ? (
          <div className="flex items-center justify-center gap-2 py-16 text-[13px] text-[var(--p-muted)]"><Spinner /> Loading…</div>
        ) : (
          <>
            <div className="flex-1 space-y-5 overflow-y-auto p-6">
              {/* money */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <Money k="Claimed" v={inr2(c.claimedAmount)} />
                <Money k="Approved" v={inr2(c.approvedAmount)} tone="cyan" />
                <Money k="Settled" v={inr2(c.settledAmount)} tone="cyan" />
              </div>
              {/* policy */}
              <div className="grid grid-cols-2 gap-x-6 gap-y-2.5 rounded-xl border border-[var(--p-border)] p-4 text-[12.5px]">
                <Row k="Policy no" v={c.policyNo} mono />
                <Row k="Member ID" v={c.memberId ?? "—"} mono />
                <Row k="Sum insured" v={inr2(c.sumInsured)} mono />
                <Row k="Insurer ref" v={c.insurerRef ?? "—"} mono />
                <Row k="Diagnosis" v={c.diagnosis ?? "—"} span />
                {c.remarks && <Row k="Remarks" v={c.remarks} span />}
              </div>
              {/* timeline */}
              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--p-muted)]">Timeline</p>
                <ol className="relative space-y-3 border-l border-[var(--p-border)] pl-5">
                  {c.events.map((e, i) => (
                    <li key={i} className="relative">
                      <span className="absolute -left-[23px] top-1 grid h-3 w-3 place-items-center rounded-full bg-[var(--p-blue)] ring-4 ring-white" />
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className="text-[12.5px] font-semibold text-[var(--p-ink)]">{eventLabel(e.kind)}{e.amount ? ` · ${inr2(e.amount)}` : ""}</span>
                        <span className="font-mono text-[10.5px] text-[var(--p-muted)]">{when(e.at)} · {e.by}</span>
                      </div>
                      {e.detail && <p className="mt-0.5 text-[12px] text-[var(--p-text)]">{e.detail}</p>}
                    </li>
                  ))}
                </ol>
              </div>
              {err && <p className="rounded-lg border border-[var(--p-rose)]/25 bg-[var(--p-rose-soft)] px-4 py-2.5 text-[12.5px] text-[var(--p-rose)]">{err}</p>}
            </div>

            {/* action bar */}
            <div className="border-t border-[var(--p-border)] px-6 py-4">
              {form ? (
                <div className="space-y-3">
                  <p className="text-[13px] font-semibold text-[var(--p-ink)]">{actionTitle(form.action)}</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {(form.action === "APPROVE" || form.action === "SETTLE") && (
                      <input className={inp} inputMode="numeric" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value.replace(/[^\d.]/g, "") })} placeholder={form.action === "APPROVE" ? "Approved amount ₹" : "Amount received ₹"} />
                    )}
                    {(form.action === "SUBMIT" || form.action === "APPROVE") && (
                      <input className={inp} value={form.insurerRef} onChange={(e) => setForm({ ...form, insurerRef: e.target.value })} placeholder="Insurer ref / auth no (optional)" />
                    )}
                    <input className={`${inp} sm:col-span-2`} value={form.detail} onChange={(e) => setForm({ ...form, detail: e.target.value })}
                      placeholder={form.action === "REJECT" ? "Reason for rejection" : form.action === "QUERY" ? "What did the insurer ask for?" : form.action === "NOTE" ? "Note" : "Note (optional)"} />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button onClick={() => setForm(null)} className="rounded-md border border-[var(--p-border)] px-4 py-2 text-[13px] font-medium text-[var(--p-text)]">Cancel</button>
                    <button onClick={confirm} disabled={busy} className="btn-primary inline-flex items-center gap-2 rounded-md px-5 py-2 text-[13px] font-semibold text-white disabled:opacity-40">
                      {busy ? <><Spinner size={14} /> Working…</> : "Confirm"}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-end gap-2">
                  {availableActions(c.status).map((x) => (
                    <button key={x.a} onClick={() => startAction(x.a)}
                      className={x.tone === "primary"
                        ? "btn-primary rounded-md px-4 py-2.5 text-[13px] font-semibold text-white"
                        : x.tone === "danger"
                          ? "rounded-md border border-[var(--p-rose)]/40 px-4 py-2.5 text-[13px] font-medium text-[var(--p-rose)] hover:bg-[var(--p-rose-soft)]"
                          : "rounded-md border border-[var(--p-border)] px-4 py-2.5 text-[13px] font-medium text-[var(--p-text)] hover:border-[var(--p-blue)] hover:text-[var(--p-blue)]"}>
                      {x.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
      <style jsx>{`
        .clm-veil { position: fixed; inset: 0; z-index: 60; display: flex; align-items: center; justify-content: center; padding: 16px; background: rgba(12,26,28,0.5); backdrop-filter: blur(2px); }
        .clm-sheet { box-shadow: 0 30px 70px -20px rgba(12,26,28,0.5); animation: cin .22s cubic-bezier(.22,.68,.28,1) both; }
        @keyframes cin { from { opacity: 0; transform: translateY(10px) scale(.99); } to { opacity: 1; transform: none; } }
        @media (prefers-reduced-motion: reduce) { .clm-sheet { animation: none; } }
      `}</style>
    </div>
  );
}

const Money = ({ k, v, tone }: { k: string; v: string; tone?: "cyan" }) => (
  <div className="rounded-lg border border-[var(--p-border)] bg-[var(--p-bg)] px-2 py-2.5">
    <div className="text-[9.5px] font-semibold uppercase tracking-wide text-[var(--p-muted)]">{k}</div>
    <div className={`mt-0.5 font-mono text-[14px] font-bold ${tone === "cyan" ? "text-[var(--p-cyan-deep)]" : "text-[var(--p-ink)]"}`}>{v}</div>
  </div>
);
const Row = ({ k, v, mono, span }: { k: string; v: string; mono?: boolean; span?: boolean }) => (
  <div className={span ? "col-span-2" : ""}>
    <span className="text-[10.5px] font-semibold uppercase tracking-wide text-[var(--p-muted)]">{k}</span>
    <div className={`text-[13px] text-[var(--p-ink)] ${mono ? "font-mono text-[12.5px]" : ""}`}>{v}</div>
  </div>
);

function eventLabel(k: string) {
  return ({ CREATED: "Claim raised", SUBMITTED: "Submitted to insurer", QUERIED: "Insurer queried", APPROVED: "Approved", PARTIALLY_APPROVED: "Partly approved", REJECTED: "Rejected", SETTLED: "Settled", NOTE: "Note" } as Record<string, string>)[k] ?? k;
}
function actionTitle(a: string) {
  return ({ SUBMIT: "Submit to insurer / TPA", APPROVE: "Record the insurer's approval", QUERY: "Insurer raised a query", REJECT: "Record a rejection", SETTLE: "Record settlement received", NOTE: "Add a note" } as Record<string, string>)[a] ?? a;
}
function actionMsg(a: string) {
  return ({ SUBMIT: "Claim submitted to the insurer.", APPROVE: "Approval recorded.", QUERY: "Query recorded.", REJECT: "Rejection recorded.", SETTLE: "Settlement recorded.", NOTE: "Note added." } as Record<string, string>)[a] ?? "Updated.";
}
