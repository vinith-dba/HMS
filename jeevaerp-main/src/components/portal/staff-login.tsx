"use client";

import { useState } from "react";
import { api, ApiClientError } from "@/lib/api-client";

/**
 * Staff sign-in. Two modes:
 *  - OTP (default): enter username (role.name) → 6-digit code sent to the
 *    registered email (prints to server console in dev). Only works if the
 *    username exists in the DB.
 *  - Password: username + password fallback.
 * On success the API returns an absolute redirectTo (the role's portal), so we
 * do a full navigation — the cookie is domain-wide and valid on arrival.
 */
export function StaffLogin({ portalName = "Staff" }: { portalName?: string }) {
  const [mode, setMode] = useState<"otp" | "password">("otp");
  const [step, setStep] = useState<"username" | "code">("username");
  const [username, setUsername] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [sentTo, setSentTo] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function requestCode() {
    setError(null);
    if (username.trim().length < 3) { setError("Enter your username."); return; }
    setLoading(true);
    try {
      const { sentTo } = await api.post<{ sentTo: string }>("/auth/staff/otp/request", { username });
      setSentTo(sentTo); setStep("code");
    } catch (e) { setError(e instanceof ApiClientError ? e.message : "Something went wrong."); }
    finally { setLoading(false); }
  }

  async function verifyCode() {
    setError(null);
    if (!/^\d{6}$/.test(code)) { setError("Enter the 6-digit code."); return; }
    setLoading(true);
    try {
      const { redirectTo } = await api.post<{ redirectTo: string }>("/auth/staff/otp/verify", { username, code });
      window.location.assign(redirectTo || "/");
    } catch (e) { setError(e instanceof ApiClientError ? e.message : "Sign-in failed."); setLoading(false); }
  }

  async function passwordLogin() {
    setError(null);
    if (username.trim().length < 3 || !password) { setError("Enter username and password."); return; }
    setLoading(true);
    try {
      const { redirectTo } = await api.post<{ redirectTo: string }>("/auth/staff/login", { username, password });
      window.location.assign(redirectTo || "/");
    } catch (e) { setError(e instanceof ApiClientError ? e.message : "Sign-in failed."); setLoading(false); }
  }

  function switchMode(next: "otp" | "password") {
    if (next === mode) return;
    setMode(next); setStep("username"); setError(null); setCode(""); setPassword("");
  }

  const label = "font-mono text-[10.5px] font-medium uppercase tracking-[0.16em] text-[var(--p-muted)]";
  const field = "mt-2 w-full border border-[var(--p-border)] bg-white px-4 py-3.5 text-sm text-[var(--p-ink)]";

  return (
    <div className="surface w-full p-8 sm:p-9" style={{ borderRadius: 28 }}>
      <p className="eyebrow">{portalName} portal</p>
      <h1 className="mt-3 font-serif-p text-[26px] font-semibold leading-tight text-[var(--p-ink)]">
        {mode === "otp" && step === "code" ? "Enter your code" : "Sign in to Jeeva"}
      </h1>
      <p className="mt-2 text-[13px] leading-relaxed text-[var(--p-muted)]">
        {mode === "otp"
          ? step === "username" ? "Enter your username (e.g. reception.ravi) and we'll email you a one-time login code."
            : `A 6-digit code was sent to ${sentTo}. It expires in 5 minutes.`
          : "Enter your username and password."}
      </p>

      {/* mode toggle — a segmented pill */}
      {!(mode === "otp" && step === "code") && (
        <div className="mt-6 grid grid-cols-2 gap-1 rounded-full border border-[var(--p-border)] bg-[var(--p-bg)] p-1">
          {([["otp", "Email code"], ["password", "Password"]] as const).map(([m, t]) => (
            <button key={m} onClick={() => switchMode(m)}
              className={`rounded-full py-2 text-[12.5px] font-semibold transition-all ${
                mode === m ? "bg-white text-[var(--p-blue-deep)] shadow-[var(--p-shadow-sm)]" : "text-[var(--p-muted)] hover:text-[var(--p-ink)]"
              }`}>
              {t}
            </button>
          ))}
        </div>
      )}

      {error && (
        <div className="mt-5 rounded-[14px] border border-[var(--p-rose)]/25 bg-[var(--p-rose-soft)] px-4 py-3 text-[13px] text-[var(--p-rose)]">
          {error}
        </div>
      )}

      {mode === "otp" ? (
        step === "username" ? (
          <div className="mt-6 space-y-5">
            <div>
              <label className={label} htmlFor="login-username">Username</label>
              <input id="login-username" value={username} onChange={(e) => setUsername(e.target.value.toLowerCase())}
                onKeyDown={(e) => e.key === "Enter" && requestCode()}
                placeholder="portal.name" autoComplete="username" className={field} />
            </div>
            <button onClick={requestCode} disabled={loading}
              className="btn-primary w-full rounded-full py-3.5 text-sm font-semibold text-white disabled:opacity-50">
              {loading ? "Sending…" : "Send code →"}
            </button>
          </div>
        ) : (
          <div className="mt-6 space-y-5">
            <input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              onKeyDown={(e) => e.key === "Enter" && verifyCode()}
              placeholder="••••••" inputMode="numeric" autoFocus
              className="w-full border border-[var(--p-border)] bg-white px-4 py-4 text-center font-mono text-[22px] tracking-[0.5em] text-[var(--p-ink)]" />
            <button onClick={verifyCode} disabled={loading}
              className="btn-primary w-full rounded-full py-3.5 text-sm font-semibold text-white disabled:opacity-50">
              {loading ? "Verifying…" : "Verify & sign in →"}
            </button>
            <button onClick={() => { setStep("username"); setCode(""); setError(null); }}
              className="w-full text-center font-mono text-[10.5px] font-medium uppercase tracking-[0.16em] text-[var(--p-muted)] transition-colors hover:text-[var(--p-blue)]">
              ← Change username
            </button>
          </div>
        )
      ) : (
        <div className="mt-6 space-y-5">
          <div>
            <label className={label} htmlFor="login-user2">Username</label>
            <input id="login-user2" value={username} onChange={(e) => setUsername(e.target.value.toLowerCase())}
              placeholder="reception.ravi" autoComplete="username" className={field} />
          </div>
          <div>
            <label className={label} htmlFor="login-pass">Password</label>
            <input id="login-pass" type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && passwordLogin()}
              placeholder="••••••••" autoComplete="current-password" className={field} />
          </div>
          <button onClick={passwordLogin} disabled={loading}
            className="btn-primary w-full rounded-full py-3.5 text-sm font-semibold text-white disabled:opacity-50">
            {loading ? "Signing in…" : "Sign in →"}
          </button>
        </div>
      )}
    </div>
  );
}
