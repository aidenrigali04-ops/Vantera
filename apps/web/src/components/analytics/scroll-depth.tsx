"use client";

import { useEffect, useRef } from "react";
import { trackEvent } from "@/lib/analytics/clarity";

/**
 * Landing scroll-depth instrumentation. Fires `scroll_depth` (with a `pct` of 25/50/75/100)
 * once each per page load through the shared trackEvent fan-out (Clarity + GA4 + Meta), so
 * the next conversion analysis can see where on the page real visitors give up — today the
 * landing CTAs and page have no click/scroll instrumentation at all.
 *
 * Passive listener, self-removing once every milestone has fired. Renders nothing; mount
 * once near the top of the landing page.
 */
const THRESHOLDS = [25, 50, 75, 100] as const;

export function ScrollDepthTracker() {
  const fired = useRef<Set<number>>(new Set());

  useEffect(() => {
    const onScroll = () => {
      const doc = document.documentElement;
      const scrollable = doc.scrollHeight - doc.clientHeight;
      if (scrollable <= 0) return;
      const pct = Math.min(100, Math.round((doc.scrollTop / scrollable) * 100));
      for (const t of THRESHOLDS) {
        if (pct >= t && !fired.current.has(t)) {
          fired.current.add(t);
          trackEvent("scroll_depth", { pct: String(t) });
        }
      }
      if (fired.current.size === THRESHOLDS.length) {
        window.removeEventListener("scroll", onScroll);
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll(); // capture a short page / initial position immediately
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return null;
}
