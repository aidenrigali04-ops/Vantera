"use client";

import { useEffect, useState } from "react";
import { fmtUntil } from "@/lib/today/fmt-until";

const TICK_MS = 60_000;

/**
 * A server-rendered "in ~12 min" that stays honest while the page sits open: the first render
 * is the server's string (no `Date.now()` during render, so no hydration drift), then a 60s
 * interval re-formats it from the ISO instant. `at === null` keeps the server string.
 */
export function useUntil(at: string | null, serverLabel: string): string {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    if (!at) return;
    const id = window.setInterval(() => setNow(new Date()), TICK_MS);
    return () => window.clearInterval(id);
  }, [at]);
  return at && now ? fmtUntil(at, now) : serverLabel;
}
