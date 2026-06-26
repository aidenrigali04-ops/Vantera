"use client";

import { motion } from "framer-motion";
import { Check, Pencil, Sparkles } from "lucide-react";
import { Avatar, MockChrome } from "./parts";

const SIGNALS = ["Onboarding pain", "Hiring · +50 hires"];

export function AiDraft() {
  return (
    <MockChrome label="Outreach draft">
      <div className="flex items-center gap-3 px-1 pb-3">
        <Avatar initials="TS" i={0} />
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[13px] font-medium text-white/90">
            <Sparkles className="size-3.5 text-[var(--cyan)]" strokeWidth={1.9} />
            AI draft
          </p>
          <p className="text-[11px] text-white/40">Written from her activity</p>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap gap-1.5 px-1">
        {SIGNALS.map((s) => (
          <span
            key={s}
            className="inline-flex items-center gap-1 rounded-full border border-[var(--cyan)]/25 bg-[var(--cyan)]/10 px-2.5 py-1 text-[10px] font-medium text-[var(--cyan)]"
          >
            {s}
          </span>
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-40px" }}
        transition={{ duration: 0.5 }}
        className="rounded-2xl rounded-tl-md border border-white/[0.08] bg-white/[0.04] p-4"
      >
        <p className="text-[13.5px] leading-relaxed text-white/80">
          Hi Terri — saw the team grew 50 this quarter, right after the hiring push. Most founders
          scaling that fast feel the onboarding stretch first. We cut ramp time ~half — worth a look?
        </p>
      </motion.div>

      <div className="mt-3.5 flex items-center justify-between px-1">
        <span className="text-[10.5px] font-medium uppercase tracking-[0.1em] text-white/35">
          Your sign-off required
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/12 bg-white/[0.04] px-3 py-1.5 text-[12px] font-medium text-white/70"
          >
            <Pencil className="size-3.5" strokeWidth={1.9} />
            Edit
          </button>
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--cyan)] px-3.5 py-1.5 text-[12px] font-semibold text-[#0a0c12] shadow-[0_0_18px_rgba(48,207,255,0.45)]">
            <Check className="size-3.5" strokeWidth={2.5} />
            Approve
          </span>
        </div>
      </div>
    </MockChrome>
  );
}
