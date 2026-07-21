"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Scroll reveal. Adds `.in` when the element enters the viewport, once.
 * Respects prefers-reduced-motion via CSS (see site-theme.css).
 */
export function Reveal({
  children,
  delay = 0,
  className = "",
  as: Tag = "div",
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
  as?: "div" | "section" | "li" | "span";
}) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add("in");
          io.unobserve(el);
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -60px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    // @ts-expect-error -- dynamic tag, ref type is compatible at runtime
    <Tag ref={ref} data-reveal className={className} style={{ "--d": `${delay}ms` } as React.CSSProperties}>
      {children}
    </Tag>
  );
}

/** Counts a number up when it scrolls into view. Tabular, so it never jitters. */
export function CountUp({ to, suffix = "", duration = 1400 }: { to: number; suffix?: string; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.textContent = `${to}${suffix}`;
      return;
    }

    const io = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      io.unobserve(el);
      const start = performance.now();
      const tick = (now: number) => {
        const p = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
        el.textContent = `${Math.round(to * eased)}${suffix}`;
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }, { threshold: 0.5 });

    io.observe(el);
    return () => io.disconnect();
  }, [to, suffix, duration]);

  return <span ref={ref} className="tabular">0{suffix}</span>;
}
