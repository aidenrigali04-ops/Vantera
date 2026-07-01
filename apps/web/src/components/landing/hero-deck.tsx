"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Check, Send } from "lucide-react";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

function useCountUp(target: number, run: boolean, ms = 1200) {
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

// Score ring geometry (viewBox 0 0 36 36, r = 15.5)
const RING_R = 15.5;
const RING_C = 2 * Math.PI * RING_R;
const SCORE = 91;

/**
 * Hero graphic — a single qualified-prospect card: the product's core promise in one
 * frame (a real buyer, an honest fit score, and an AI-drafted message grounded in their
 * activity, one click from your approval). Premium-light, self-contained (no external
 * image), with a score ring that draws + counts up on enter.
 */
export function HeroDeck() {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(id);
  }, []);
  const score = useCountUp(SCORE, shown);

  return (
    <div className="relative mx-auto w-full max-w-[380px]">
      {/* soft cyan glow lifting the card */}
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-x-8 -bottom-10 -top-6 -z-10 rounded-[2.25rem] blur-2xl"
        style={{ background: "radial-gradient(60% 75% at 55% 30%, rgba(11, 87, 171,0.18), transparent 70%)" }}
      />

      <div
        className="rounded-[18px] border border-[#E6EAEE] bg-white p-5"
        style={{
          boxShadow:
            "inset 0 1px 0 rgba(255,255,255,.7), 0 1px 2px rgba(16,24,32,.05), 0 18px 42px -20px rgba(16,24,32,.30)",
        }}
      >
        {/* header */}
        <div className="flex items-center gap-3">
          <div className="relative h-11 w-11 flex-none">
            <div className="grid h-11 w-11 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-[#EEF2F6] to-[#E3E9EF] text-[14px] font-semibold text-[#5B6B78]">
              SC
            </div>
            <span className="absolute -bottom-[3px] -right-[3px] grid h-[18px] w-[18px] place-items-center rounded-[6px] bg-[#0A66C2] text-[9px] font-bold leading-none tracking-[-0.02em] text-white ring-2 ring-white">
              in
            </span>
          </div>
          <div className="min-w-0">
            <div className="truncate text-[15px] font-semibold leading-tight tracking-[-0.01em] text-[#0C1620]">
              Sarah Chen
            </div>
            <div className="truncate text-[12.5px] text-[#8E9AA3]">VP Sales · Northwind</div>
          </div>
          <span className="ml-auto inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-[rgba(11, 87, 171,0.12)] px-2.5 py-[5px] text-[11.5px] font-semibold text-[#0A7CA6]">
            <span className="size-1.5 rounded-full bg-[#0b57ab]" />
            High intent
          </span>
        </div>

        {/* signal */}
        <div className="mt-3 flex items-center gap-2 text-[11.5px] font-medium text-[#54636D]">
          <span className="size-1.5 flex-none rounded-full bg-[#0b57ab]" />
          Raised Series B · engaging on pipeline forecasting
        </div>

        <div className="my-3.5 h-px bg-[#EFF2F5]" />

        {/* score */}
        <div className="flex items-center gap-3.5">
          <div className="relative h-[58px] w-[58px] flex-none">
            <svg viewBox="0 0 36 36" className="h-[58px] w-[58px]">
              <circle cx="18" cy="18" r={RING_R} fill="none" stroke="#EAEEF1" strokeWidth="3" />
              <motion.circle
                cx="18"
                cy="18"
                r={RING_R}
                fill="none"
                stroke="#0b57ab"
                strokeWidth="3"
                strokeLinecap="round"
                transform="rotate(-90 18 18)"
                strokeDasharray={RING_C}
                initial={{ strokeDashoffset: RING_C }}
                animate={shown ? { strokeDashoffset: RING_C * (1 - SCORE / 100) } : {}}
                transition={{ duration: 1.2, ease: EASE }}
              />
            </svg>
            <span className="absolute inset-0 grid place-items-center text-[18px] font-bold tabular-nums tracking-[-0.02em] text-[#0C1620]">
              {score}
            </span>
          </div>
          <div>
            <div className="flex items-center gap-1.5 text-[13px] font-semibold leading-snug text-[#0C1620]">
              <Check className="size-3.5 text-[#1A9463]" strokeWidth={3} />
              Qualified
            </div>
            <div className="mt-0.5 text-[11.5px] text-[#8E9AA3]">Fit 94 · Intent 88 · 70+ to pass</div>
          </div>
        </div>

        {/* drafted message */}
        <div className="mt-3.5 rounded-l-none rounded-r-[12px] border border-l-[3px] border-[#EDF1F4] border-l-[#0b57ab] bg-[#F7F9FB] px-[13px] py-3">
          <div className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-[#9AA5AD]">
            Drafted from her activity
          </div>
          <div className="text-[12.5px] leading-[1.55] text-[#1C2730]">
            Hi Sarah — your point about forecasting accuracy after the raise stuck with me. Open to a
            quick look at how Northwind could close it?
          </div>
        </div>

        {/* tags */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          <span className="inline-flex items-center gap-1.5 rounded-[7px] bg-[#F2F5F8] px-2 py-[5px] text-[10.5px] font-medium text-[#54636D]">
            <Check className="size-[11px] text-[#1A9463]" strokeWidth={3} />
            No template variables
          </span>
          <span className="inline-flex items-center rounded-[7px] bg-[#F2F5F8] px-2 py-[5px] text-[10.5px] font-medium text-[#54636D]">
            Grounded in her posts
          </span>
        </div>

        {/* actions */}
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            className="flex-none rounded-[11px] border border-[#E6EAEE] bg-white px-4 py-[11px] text-[13px] font-semibold text-[#54636D] transition-colors hover:bg-[#F6F8FA]"
          >
            Edit
          </button>
          <button
            type="button"
            className="flex flex-1 items-center justify-center gap-2 rounded-[11px] bg-[#0b57ab] py-[11px] text-[13.5px] font-semibold text-[#06303F] transition-colors hover:bg-[#22C2F4] active:bg-[#1AB6E9]"
          >
            <Send className="size-4" strokeWidth={2.4} />
            Approve &amp; send
          </button>
        </div>
      </div>
    </div>
  );
}
