"use client";

import { motion } from "framer-motion";
import { Avatar, MockChrome } from "./parts";

const ROWS = [
  { initials: "CS", name: "Charles Steinmetz", role: "Founder & AI Architect · Pinocchio LLC", score: 82 },
  { initials: "DH", name: "Dana Holt", role: "Founder & CEO · TS Digital Solutions", score: 78 },
  { initials: "MS", name: "Manuel Suarez", role: "CEO · AGM Agency", score: 41 },
];

const BAR = 70;

export function Qualification() {
  return (
    <MockChrome label="Qualification">
      <div className="flex items-center justify-between px-1 pb-3">
        <div>
          <p className="text-[13px] font-semibold text-foreground">Qualification</p>
          <p className="text-[11px] text-[var(--ink-4)]">15 reviewed · 9 cleared the bar</p>
        </div>
        <span className="rounded-full border border-[rgba(48,207,255,0.3)] bg-[var(--cyan-tint)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--cyan-strong)]">
          Bar {BAR}
        </span>
      </div>

      <div className="flex flex-col gap-2">
        {ROWS.map((r, i) => {
          const cleared = r.score >= BAR;
          return (
            <motion.div
              key={r.name}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.45, delay: i * 0.1 }}
              className="rounded-xl border border-[var(--hairline)] bg-[#fbfcfe] p-2.5"
            >
              <div className="flex items-center gap-3">
                <Avatar initials={r.initials} i={i} />
                <div className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-semibold text-foreground">{r.name}</span>
                  <span className="block truncate text-[11.5px] text-[var(--ink-3)]">{r.role}</span>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className={cleared ? "text-[15px] font-semibold tabular-nums text-[var(--cyan-strong)]" : "text-[15px] font-semibold tabular-nums text-[var(--ink-4)]"}>
                    {r.score}
                  </span>
                  <span
                    className={
                      cleared
                        ? "rounded-full bg-[var(--cyan-tint)] px-2 py-0.5 text-[8.5px] font-bold uppercase tracking-[0.08em] text-[var(--cyan-strong)]"
                        : "rounded-full bg-[#f1f2f4] px-2 py-0.5 text-[8.5px] font-bold uppercase tracking-[0.08em] text-[var(--ink-4)]"
                    }
                  >
                    {cleared ? "Qualified" : "Below bar"}
                  </span>
                </div>
              </div>
              <div className="relative mt-2.5 h-1.5 overflow-hidden rounded-full bg-[#eef0f3]">
                <motion.span
                  initial={{ width: 0 }}
                  whileInView={{ width: `${r.score}%` }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.7, delay: 0.15 + i * 0.1, ease: [0.22, 1, 0.36, 1] }}
                  className="absolute inset-y-0 left-0 rounded-full"
                  style={{ backgroundColor: cleared ? "var(--cyan)" : "#c9cdd4" }}
                />
                <span className="absolute inset-y-[-2px] w-px bg-[var(--cyan-strong)]/60" style={{ left: `${BAR}%` }} />
              </div>
            </motion.div>
          );
        })}
      </div>

      <p className="mt-3 px-1 text-[11px] text-[var(--ink-4)]">
        Scored on fit, seniority &amp; intent — only the best are pursued
      </p>
    </MockChrome>
  );
}
