"use client";

import { useEffect, useState } from "react";
import { fmtUntil } from "@/lib/today/fmt-until";

const TICK_MS = 60_000;

/**
 * A server-rendered "in ~12 min" that stays honest while the page sits open: the first render
 * is the server's label (no `Date.now()` during render, so no hydration drift), then a 60s
 * interval re-formats it from the ISO instant. A tick is tied to the `at` it was taken for, so
 * a refreshed `at` shows its fresh server label at once instead of formatting against a stale
 * clock. `at === null` keeps the server label.
 */
export function useUntil(at: string | null, serverLabel: string): string {
  const [tick, setTick] = useState<{ at: string; now: Date } | null>(null);
  useEffect(() => {
    if (!at) return;
    const id = window.setInterval(() => setTick({ at, now: new Date() }), TICK_MS);
    return () => window.clearInterval(id);
  }, [at]);
  return at && tick?.at === at ? fmtUntil(at, tick.now) : serverLabel;
}
