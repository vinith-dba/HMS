import type { CSSProperties, ReactNode } from "react";

type Corner = "tl" | "tr" | "bl" | "br";

/**
 * The scoop — an inverted-radius corner notch cut out of a rounded panel,
 * with content (a pill CTA, a chip, an arrow button) docked inside the bite.
 * Parent must be `relative`; `bg` must match the colour BEHIND the panel.
 */
export function Scoop({
  corner = "br",
  bg,
  r = 20,
  inner = 24,
  className = "",
  children,
}: {
  corner?: Corner;
  /** CSS colour behind the panel, e.g. "var(--bone)". Defaults to the canvas. */
  bg?: string;
  /** Concave curve radius, px. */
  r?: number;
  /** Inner corner radius of the notch, px. */
  inner?: number;
  className?: string;
  children?: ReactNode;
}) {
  const style: CSSProperties = {
    ...(bg ? ({ "--scoop-bg": bg } as CSSProperties) : {}),
    ...({ "--scoop-r": `${r}px`, "--scoop-in": `${inner}px` } as CSSProperties),
  };
  return (
    <div className={`scoop scoop-${corner} ${className}`} style={style}>
      {children}
    </div>
  );
}
