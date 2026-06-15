"use client";

import { motion } from "framer-motion";
import {
  CalendarCheck,
  ChevronRight,
  Mail,
  MessageSquare,
  Phone,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
import { SectionHeading } from "./section-heading";

/**
 * The multi-channel sequence — the orchestration layer. Each qualified lead runs
 * LinkedIn → Email → iMessage → Caller automatically, and the run halts the
 * instant they convert. This is the differentiator the single-channel tools miss.
 */
const STAGES: { icon: LucideIcon; label: string; note: string }[] = [
  { icon: UserPlus, label: "LinkedIn", note: "Connect + a personal DM" },
  { icon: Mail, label: "Email", note: "Personalized, from a warmed inbox" },
  { icon: MessageSquare, label: "iMessage", note: "A well-timed text nudge" },
  { icon: Phone, label: "Caller", note: "An AI call that books the meeting" },
];

export function SequenceSection() {
  return (
    <section id="sequence" className="relative px-4 py-24">
      <SectionHeading
        eyebrow="Multi-channel sequence"
        title="One sequence. Every channel. It stops the moment they say yes."
        subtitle="Each qualified lead flows through LinkedIn, email, iMessage, and a real call — automatically. The instant they reply or book, the run halts and the lead is marked closed. No double-touching, no wasted reach."
      />

      <div className="mx-auto mt-14 max-w-5xl">
        <div className="flex flex-col gap-3 md:flex-row md:items-stretch">
          {STAGES.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="flex items-center gap-3 md:flex-1 md:flex-col md:items-stretch"
            >
              <div className="w-full rounded-2xl border border-white/[0.16] bg-white/[0.06] p-5 shadow-lg shadow-black/25">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[11px] tracking-[0.18em] text-muted-foreground uppercase">
                    Step {i + 1}
                  </span>
                  <s.icon className="size-4 text-foreground/80" aria-hidden />
                </div>
                <h3 className="font-heading mt-3 text-base font-semibold text-foreground">
                  {s.label}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">{s.note}</p>
              </div>
              {i < STAGES.length - 1 && (
                <ChevronRight
                  className="size-4 shrink-0 rotate-90 text-muted-foreground/40 md:rotate-0 md:self-center"
                  aria-hidden
                />
              )}
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.5, delay: 0.45 }}
          className="mt-4 flex items-center justify-center gap-2.5 rounded-2xl border border-white/[0.16] bg-white/[0.06] px-5 py-4 text-center shadow-lg shadow-black/25"
        >
          <CalendarCheck className="size-4 shrink-0 text-foreground" aria-hidden />
          <p className="text-sm text-muted-foreground">
            <span className="text-foreground">Conversion at any stage closes the lead</span> and
            skips the rest — your agents never waste a touch on someone who already said yes.
          </p>
        </motion.div>
      </div>
    </section>
  );
}
