"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiClientError } from "@/lib/api-client";

type Step = "id" | "otp";

export function PortalLogin() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("id");
  const [patientId, setPatientId] = useState("");
  const [otp, setOtp] = useState("");
  const [sentTo, setSentTo] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function requestOtp() {
    setError(null);
    if (!/^JMH\d{4}OP\d{5}$/.test(patientId.trim())) {
      setError("Enter a valid Jeeva ID, like JMH2026OP00123.");
      return;
    }
    setLoading(true);
    try {
      const { sentTo } = await api.post<{ sentTo: string }>("/auth/otp/request", {
        patientId,
      });
      setSentTo(sentTo);
      setStep("otp");
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  async function verifyOtp() {
    setError(null);
    if (!/^\d{6}$/.test(otp)) {
      setError("Enter the 6-digit code.");
      return;
    }
    setLoading(true);
    try {
      const { redirectTo } = await api.post<{ redirectTo: string }>(
        "/auth/otp/verify",
        { patientId, code: otp }
      );
      // Same-origin path for patients -> client-side nav.
      router.push(redirectTo || "/portal/profile");
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  const label = "text-[11px] font-semibold uppercase tracking-[0.16em] text-muted";

  return (
    <div className="w-full max-w-sm rounded-2xl border border-line bg-white p-8 shadow-[0_28px_70px_-40px_rgba(11,18,32,0.35)]">
      <p className="eyebrow">Patient portal</p>
      <h1 className="mt-3 font-display text-2xl font-semibold text-ink">
        {step === "id" ? (
          <>Sign in with your <span className="text-blue">Jeeva ID</span></>
        ) : (
          "Enter the code we sent"
        )}
      </h1>
      <p className="mt-2 text-[13px] leading-relaxed text-muted">
        {step === "id"
          ? "It's printed on your OP slip — like JMH2026OP00123. We'll text a one-time code to your registered mobile."
          : `A 6-digit code was sent to ${sentTo}. It expires in 5 minutes.`}
      </p>

      {error && (
        <div className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">
          {error}
        </div>
      )}

      {step === "id" ? (
        <div className="mt-6 space-y-5">
          <div>
            <label htmlFor="pid" className={label}>Jeeva ID</label>
            <input
              id="pid"
              value={patientId}
              onChange={(e) => setPatientId(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && requestOtp()}
              placeholder="JMH2026OP00123"
              autoComplete="off"
              className="mt-2 w-full rounded-xl border border-line px-4 py-3 font-mono text-sm tracking-wider text-ink outline-none focus:border-blue"
            />
          </div>
          <button
            onClick={requestOtp}
            disabled={loading}
            className="w-full rounded-full bg-blue py-3.5 text-sm font-medium text-white transition-colors hover:bg-blue-deep disabled:opacity-60"
          >
            {loading ? "Sending…" : "Send OTP"}
          </button>
        </div>
      ) : (
        <div className="mt-6 space-y-5">
          <input
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
            onKeyDown={(e) => e.key === "Enter" && verifyOtp()}
            placeholder="••••••"
            inputMode="numeric"
            autoFocus
            className="w-full rounded-xl border border-line px-4 py-3 text-center font-mono text-xl tracking-[0.5em] text-ink outline-none focus:border-blue"
          />
          <button
            onClick={verifyOtp}
            disabled={loading}
            className="w-full rounded-full bg-blue py-3.5 text-sm font-medium text-white transition-colors hover:bg-blue-deep disabled:opacity-60"
          >
            {loading ? "Verifying…" : "Verify & sign in"}
          </button>
          <button
            onClick={() => { setStep("id"); setOtp(""); setError(null); }}
            className="w-full text-center text-[11px] font-semibold uppercase tracking-[0.16em] text-muted hover:text-blue"
          >
            ← Different ID
          </button>
        </div>
      )}
    </div>
  );
}
