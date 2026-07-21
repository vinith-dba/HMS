"use client";

/**
 * Collections-by-payment-type card — the "counter" tally.
 *
 * Reception has always had this at day-close; this is the same split (CASH /
 * UPI / CARD / …) as a reusable card so the pharmacy till, the lab till and the
 * admin (all counters) can see what they took today and in what form. Fed a
 * plain array so it stays a dumb presentational component — the maths lives in
 * `collectionByMode` on the server.
 */

export interface CollectionMode {
  mode: string;
  collected: number;
  refunded: number;
  net: number;
  count: number;
}

const LABEL: Record<string, string> = {
  CASH: "Cash",
  UPI: "UPI",
  CARD: "Card",
  NETBANKING: "Net banking",
  OTHER: "Other",
};

const inr = (n: number) => n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function CollectionsCard({
  modes,
  accent = "teal",
  subtitle,
}: {
  modes: CollectionMode[];
  accent?: "teal" | "blue";
  subtitle?: string;
}) {
  const accentVar = accent === "blue" ? "var(--p-blue)" : "var(--p-teal)";
  const active = (modes ?? []).filter((m) => m.collected > 0 || m.refunded > 0 || m.count > 0);
  const collected = active.reduce((s, m) => s + m.collected, 0);
  const refunded = active.reduce((s, m) => s + m.refunded, 0);
  const net = collected - refunded;

  return (
    <section data-rise className="surface overflow-hidden">
      <div className="flex items-center justify-between border-b border-[var(--p-border)] px-6 py-4">
        <div>
          <h3 className="text-[14px] font-semibold text-[var(--p-ink)]">Collections by payment type</h3>
          <p className="mt-0.5 text-[12px] text-[var(--p-muted)]">{subtitle ?? "Collected today at this counter"}</p>
        </div>
        <span
          className="rounded-full px-2.5 py-1 text-[11px] font-semibold text-white"
          style={{ background: accentVar }}
        >
          ₹{inr(collected)}
        </span>
      </div>

      <div className="p-6">
        {active.length === 0 ? (
          <p className="py-3 text-center text-[13px] text-[var(--p-muted)]">No collections recorded yet today.</p>
        ) : (
          <div className="space-y-2.5">
            {active.map((m) => (
              <div key={m.mode} className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span className="inline-block h-2 w-2 rounded-full" style={{ background: accentVar }} />
                  <span className="text-[13px] font-medium text-[var(--p-ink)]">{LABEL[m.mode] ?? m.mode}</span>
                  <span className="text-[11px] text-[var(--p-muted)]">· {m.count} {m.count === 1 ? "txn" : "txns"}</span>
                </span>
                <span className="whitespace-nowrap text-right">
                  <span className="font-mono text-[14px] font-semibold text-[var(--p-ink)]">₹{inr(m.collected)}</span>
                  {m.refunded > 0 && (
                    <span className="ml-2 font-mono text-[11px] text-[var(--p-rose)]">−₹{inr(m.refunded)}</span>
                  )}
                </span>
              </div>
            ))}

            <div className="mt-1 flex items-center justify-between border-t border-[var(--p-border)] pt-2.5">
              <span className="text-[13px] font-semibold text-[var(--p-ink)]">Total collected</span>
              <span className="font-mono text-[15px] font-bold" style={{ color: accentVar }}>₹{inr(collected)}</span>
            </div>

            {refunded > 0 && (
              <div className="flex items-center justify-between text-[11px] text-[var(--p-muted)]">
                <span>Less refunds today</span>
                <span className="font-mono">−₹{inr(refunded)} · net ₹{inr(net)}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
