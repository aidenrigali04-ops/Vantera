"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";

/** Eased count-up that fires when `active` flips true; jumps to target under reduced-motion. */
export function CountUp({
  to,
  active,
  duration = 1200,
  format = (n) => Math.round(n).toLocaleString("en-US"),
  className,
}: {
  to: number;
  active: boolean;
  duration?: number;
  format?: (n: number) => string;
  className?: string;
}) {
  const reduce = useReducedMotion();
  // null = not yet animated; the animated value is only ever written from inside
  // the rAF callback (async), so the effect never sets state synchronously.
  const [animated, setAnimated] = useState<number | null>(null);
  const raf = useRef<number>(0);

  useEffect(() => {
    if (!active || reduce) return;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setAnimated(to * eased);
      if (t < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [active, to, duration, reduce]);

  const value = !active ? 0 : reduce ? to : (animated ?? 0);
  return <span className={className}>{format(value)}</span>;
}
