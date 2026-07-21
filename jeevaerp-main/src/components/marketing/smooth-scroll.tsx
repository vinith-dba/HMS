"use client";

import { useEffect } from "react";
import Lenis from "lenis";

/**
 * Smooth scrolling — PUBLIC SITE ONLY.
 *
 * Lenis gives the page the weighted, cinematic scroll the reference sites have.
 * It is deliberately not mounted in the working portals: a receptionist tabbing
 * through forms and tables needs the scrollbar to behave like an instrument,
 * not an experience.
 *
 * Two non-negotiables:
 *  - prefers-reduced-motion users get native scrolling, full stop.
 *  - anchor links (#departments, #faq…) route through Lenis so the nav glides
 *    instead of jumping, with an offset for the fixed header.
 */
export function SmoothScroll() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const lenis = new Lenis({
      duration: 1.15,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), // easeOutExpo
      touchMultiplier: 1.6,
    });

    let raf = 0;
    const loop = (time: number) => {
      lenis.raf(time);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    // glide to in-page anchors instead of jumping
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement).closest<HTMLAnchorElement>('a[href*="#"]');
      if (!a) return;
      const url = new URL(a.href, window.location.href);
      if (url.pathname !== window.location.pathname || !url.hash) return;
      const el = document.querySelector<HTMLElement>(url.hash);
      if (!el) return;
      e.preventDefault();
      lenis.scrollTo(el, { offset: -84 }); // clear the fixed navbar
      history.pushState(null, "", url.hash);
    };
    document.addEventListener("click", onClick);

    return () => {
      document.removeEventListener("click", onClick);
      cancelAnimationFrame(raf);
      lenis.destroy();
    };
  }, []);

  return null;
}
