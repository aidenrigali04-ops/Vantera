"use client";

import { motion } from "framer-motion";
import { Avatar, ScorePill, MockChrome } from "./parts";

const ROWS = [
  { initials: "TS", name: "Terri Spencer", time: "2m ago", ready: true, signal: "Comparing tools in your space", score: 92 },
  { initials: "CM", name: "Chuck McMahon", time: "14m ago", ready: false, signal: "Posting about pipeline gaps", score: 76 },
  { initials: "SP", name: "Shandi Perkins", time: "1h ago", ready: false, signal: "Company just raised funding", score: 71 },
];

export function IntentFeed() {
  return (
    <MockChrome label="Buying intent">
      <div className="flex items-center justify-between px-1 pb-3">
        <div>
          <p className="text-[13px] font-semibold text-foreground">Tracks user intent</p>
          <p className="text-[11px] text-[var(--ink-4)]">Tracking 15 prospects in real time</p>
        </div>
        <span className="inline-flex items-center gap-1.5 text-[9.5px] font-semibold uppercase tracking-[0.12em] text-[var(--cyan-strong)]">
          <span className="size-1.5 rounded-full bg-[var(--cyan)] shadow-[0_0_8px_rgba(48,207,255,0.9)]" />
          Live
        </span>
      </div>

      <div className="flex flex-col gap-2">
        {ROWS.map((r, i) => (
          <motion.div
            key={r.name}
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.45, delay: i * 0.1 }}
            className="flex items-center gap-3 rounded-xl border border-[var(--hairline)] bg-[#fbfcfe] p-2.5"
          >
            <Avatar initials={r.initials} i={i} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-[13px] font-semibold text-foreground">{r.name}</span>
                {r.ready && (
                  <span className="shrink-0 rounded-full bg-[var(--cyan-tint)] px-1.5 py-0.5 text-[8.5px] font-bold uppercase tracking-[0.1em] text-[var(--cyan-strong)]">
                    Ready
                  </span>
                )}
                <span className="ml-auto shrink-0 text-[10px] text-[var(--ink-4)]">{r.time}</span>
              </div>
              <p className="mt-0.5 truncate text-[11.5px] text-[var(--ink-3)]">{r.signal}</p>
            </div>
            <ScorePill score={r.score} />
          </motion.div>
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between px-1">
        <span className="text-[10.5px] text-[var(--cyan-strong)]">+12 more signals today</span>
        <span className="text-[10px] text-[var(--ink-4)]">Tracked automatically — no manual research</span>
      </div>
    </MockChrome>
  );
}
