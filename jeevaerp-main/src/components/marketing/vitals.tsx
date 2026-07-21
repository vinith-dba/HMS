/** The signature divider — one calm ECG pulse in a long flat line. */
export function Vitals({ className = "" }: { className?: string }) {
  return (
    <svg className={`vitals static ${className}`} viewBox="0 0 1200 28" preserveAspectRatio="none" aria-hidden>
      <path d="M0 14 H510 l10 -6 10 6 14 0 8 -11 10 20 8 -14 6 5 H1200" />
    </svg>
  );
}
