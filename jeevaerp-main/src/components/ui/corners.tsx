/**
 * Print-registration marks — the "digital paper" signature.
 * Parent must be `relative`.
 */
export function Corners({ className = "text-teal/50" }: { className?: string }) {
  const base = `pointer-events-none absolute font-mono text-[10px] leading-none select-none ${className}`;
  return (
    <>
      <span aria-hidden className={`${base} -top-[6px] -left-[5px]`}>+</span>
      <span aria-hidden className={`${base} -top-[6px] -right-[5px]`}>+</span>
      <span aria-hidden className={`${base} -bottom-[6px] -left-[5px]`}>+</span>
      <span aria-hidden className={`${base} -bottom-[6px] -right-[5px]`}>+</span>
    </>
  );
}
