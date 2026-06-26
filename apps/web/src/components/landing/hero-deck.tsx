"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { CalendarCheck, Radar, Search, Send } from "lucide-react";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

function useCountUp(target: number, run: boolean, ms = 1100) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!run) return;
    let raf = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / ms);
      const eased = 1 - Math.pow(1 - p, 3);
      setN(Math.round(target * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, run, ms]);
  return n;
}

const AGENTS = [
  { icon: Search, name: "Prospect Agent", note: "Sourcing in-market buyers" },
  { icon: Radar, name: "Intent Agent", note: "Watching for buying signals" },
  { icon: Send, name: "Outreach Agent", note: "Drafting for your approval" },
];

const WEEK = [34, 48, 41, 67, 52, 78, 71];

export function HeroDeck() {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(id);
  }, []);
  const signals = useCountUp(41, shown);
  const cleared = useCountUp(9, shown, 900);
  const drafts = useCountUp(5, shown, 800);

  return (
    <div className="relative">
      {/* sleek dark glass panel with a soft cyan glow */}
      <div className="relative overflow-hidden rounded-[20px] border border-[var(--panel-line)] bg-[var(--panel)] text-white shadow-[var(--panel-glow)]">
        {/* faint cyan light from the top-right + top rim highlight */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{ background: "radial-gradient(70% 50% at 85% -5%, rgba(48,207,255,0.14), transparent 60%)" }}
        />
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/10" />

        {/* chrome */}
        <div className="relative flex items-center gap-3 border-b border-white/[0.07] px-4 py-3">
          <div className="flex gap-1.5">
            <span className="size-2.5 rounded-full bg-white/15" />
            <span className="size-2.5 rounded-full bg-white/15" />
            <span className="size-2.5 rounded-full bg-white/15" />
          </div>
          <div className="mx-auto rounded-md bg-white/[0.05] px-3 py-1 text-[11px] text-white/40">
            app.vantera.com/pipeline
          </div>
          <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--cyan)]">
            <span className="size-1.5 rounded-full bg-[var(--cyan)] shadow-[0_0_8px_rgba(48,207,255,0.9)]" />
            Live
          </span>
        </div>

        <div className="relative grid grid-cols-[180px_1fr]">
          {/* agents rail */}
          <div className="border-r border-white/[0.07] p-3.5">
            <p className="px-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/35">
              Agents
            </p>
            <div className="mt-3 flex flex-col gap-2">
              {AGENTS.map((a, i) => (
                <motion.div
                  key={a.name}
                  initial={{ opacity: 0, x: -8 }}
                  animate={shown ? { opacity: 1, x: 0 } : {}}
                  transition={{ duration: 0.5, delay: 0.2 + i * 0.1, ease: EASE }}
                  className="flex items-start gap-2.5 rounded-xl border border-white/[0.07] bg-white/[0.03] p-2.5"
                >
                  <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-[var(--cyan)]/15 text-[var(--cyan)]">
                    <a.icon className="size-3.5" strokeWidth={1.9} />
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-[12.5px] font-medium text-white/90">{a.name}</span>
                      <span className="size-1.5 shrink-0 rounded-full bg-[#3ddc84] shadow-[0_0_6px_rgba(61,220,132,0.8)]" />
                    </div>
                    <p className="mt-0.5 text-[11px] leading-snug text-white/40">{a.note}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* main */}
          <div className="p-4">
            <div className="grid grid-cols-3 gap-2.5">
              {[
                { k: "Signals", v: signals, suffix: " today" },
                { k: "Qualified", v: cleared, suffix: " / 15" },
                { k: "To approve", v: drafts, suffix: " drafts" },
              ].map((s) => (
                <div key={s.k} className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-3">
                  <p className="text-[9.5px] font-semibold uppercase tracking-[0.1em] text-white/35">{s.k}</p>
                  <p className="mt-1.5 text-2xl font-semibold tabular-nums text-white">
                    {s.v}
                    <span className="ml-1 text-[11px] font-normal text-white/40">{s.suffix}</span>
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-3 rounded-xl border border-white/[0.07] bg-white/[0.03] p-3.5">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/35">
                  Replies this week
                </p>
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#3ddc84]">+32%</p>
              </div>
              <div className="mt-3 flex h-16 items-end gap-1.5">
                {WEEK.map((h, i) => {
                  const last = i === WEEK.length - 1;
                  return (
                    <motion.div
                      key={i}
                      initial={{ height: 0 }}
                      animate={shown ? { height: `${h}%` } : {}}
                      transition={{ duration: 0.6, delay: 0.35 + i * 0.05, ease: EASE }}
                      className="flex-1 rounded-sm"
                      style={{
                        backgroundColor: last ? "var(--cyan)" : "rgba(48,207,255,0.28)",
                        boxShadow: last ? "0 0 14px rgba(48,207,255,0.6)" : undefined,
                      }}
                    />
                  );
                })}
              </div>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={shown ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.85, ease: EASE }}
              className="mt-3 flex items-center gap-3 rounded-xl border border-[var(--cyan)]/20 bg-[var(--cyan)]/[0.07] p-3"
            >
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[var(--cyan)]/15 text-[var(--cyan)]">
                <CalendarCheck className="size-4" strokeWidth={1.9} />
              </span>
              <div className="min-w-0">
                <p className="text-[12.5px] font-medium text-white/90">Meeting booked</p>
                <p className="truncate text-[11.5px] text-white/45">Terri Spencer · Pinocchio LLC</p>
              </div>
              <span className="ml-auto shrink-0 text-[10px] font-medium text-white/35">2m ago</span>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
