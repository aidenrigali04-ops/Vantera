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
          <p className="flex items-center gap-1.5 text-[13px] font-semibold text-foreground">
            <Sparkles className="size-3.5 text-[var(--cyan-strong)]" strokeWidth={1.9} />
            AI draft
          </p>
          <p className="text-[11px] text-[var(--ink-4)]">Written from her activity</p>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap gap-1.5 px-1">
        {SIGNALS.map((s) => (
          <span
            key={s}
            className="inline-flex items-center gap-1 rounded-full border border-[rgba(48,207,255,0.3)] bg-[var(--cyan-tint)] px-2.5 py-1 text-[10px] font-medium text-[var(--cyan-strong)]"
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
        className="rounded-2xl rounded-tl-md border border-[var(--hairline)] bg-[#f6faff] p-4"
      >
        <p className="text-[13.5px] leading-relaxed text-[var(--ink-2)]">
          Hi Terri — saw the team grew 50 this quarter, right after the hiring push. Most founders
          scaling that fast feel the onboarding stretch first. We cut ramp time ~half — worth a look?
        </p>
      </motion.div>

      <div className="mt-3.5 flex items-center justify-between px-1">
        <span className="text-[10.5px] font-medium uppercase tracking-[0.1em] text-[var(--ink-4)]">
          Your sign-off required
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--hairline)] bg-white px-3 py-1.5 text-[12px] font-medium text-[var(--ink-2)]"
          >
            <Pencil className="size-3.5" strokeWidth={1.9} />
            Edit
          </button>
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--cyan-strong)] px-3.5 py-1.5 text-[12px] font-semibold text-white shadow-[0_0_16px_rgba(48,207,255,0.4)]">
            <Check className="size-3.5" strokeWidth={2.5} />
            Approve
          </span>
        </div>
      </div>
    </MockChrome>
  );
}
