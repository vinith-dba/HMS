"use client";

import { useEffect, useRef } from "react";

/**
 * Reveals [data-rise] elements as they scroll into view. Smooth scrolling is
 * native CSS — no JS scroll hijacking, so inner scroll containers work normally.
 * Respects prefers-reduced-motion.
 *
 * Elements present at mount use scroll-reveal. Elements that mount LATER (e.g.
 * content rendered after an async data load) can't be caught by the observer set
 * up at mount, so a MutationObserver reveals them as soon as they appear — this
 * is what keeps data-driven pages from rendering a blank body once data arrives.
 */
export function PortalScroll({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const reveal = (el: Element) => el.setAttribute("data-rise", "in");

    // Elements already in the DOM at mount: scroll-reveal (or reveal all if reduced motion).
    let io: IntersectionObserver | null = null;
    if (reduce) {
      root.querySelectorAll("[data-rise]").forEach(reveal);
    } else {
      io = new IntersectionObserver(
        (entries) => entries.forEach((e) => { if (e.isIntersecting) { reveal(e.target); io?.unobserve(e.target); } }),
        { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
      );
      root.querySelectorAll<HTMLElement>("[data-rise]").forEach((el) => io?.observe(el));
    }

    // Elements added after mount (post-load content): reveal them immediately so
    // they can never get stuck hidden. The CSS transition still gives a fade-in.
    const mo = new MutationObserver((mutations) => {
      for (const m of mutations) {
        m.addedNodes.forEach((node) => {
          if (node.nodeType !== 1) return;
          const el = node as Element;
          if (el.matches?.("[data-rise]:not([data-rise='in'])")) reveal(el);
          el.querySelectorAll?.("[data-rise]:not([data-rise='in'])").forEach(reveal);
        });
      }
    });
    mo.observe(root, { childList: true, subtree: true });

    return () => { io?.disconnect(); mo.disconnect(); };
  }, []);

  return <div ref={ref}>{children}</div>;
}
