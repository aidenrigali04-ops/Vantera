"use client";

import { motion } from "framer-motion";
import { Check, X, ArrowRight } from "lucide-react";
import { SectionHeading } from "./section-heading";

/**
 * The positioning spine for a buyer who's been burned by the category. Each row pairs a
 * documented AI-SDR failure (left, struck through) with Vantera's real answer (right). Every
 * claim maps to shipped behavior — quality gate, review queue, personalization from real
 * signals, ramped pacing, month-to-month billing, pipeline-vs-goal. Strict monochrome: contrast
 * is carried by weight + line-through + the check/✗, never color (DESIGN.md slop guardrails).
 */
const ROWS = [
  {
    bad: "Generic, templated blasts a prospect spots in a second",
    good: "Every message written from that prospect's own research — never a template",
  },
  {
    bad: "Books demos with anyone who replies — most unqualified",
    good: "A hard quality gate: only high-fit, well-timed leads ever get worked",
  },
  {
    bad: "Fires autonomously and misfires in your name",
    good: "Nothing sends without your sign-off in the review queue",
  },
  {
    bad: "Burns your domain with high-volume sends",
    good: "Ramped, human-like pacing protects your sender reputation",
  },
  {
    bad: "Locks you into an annual contract before it proves a thing",
    good: "Month-to-month. No lock-in — see the pipeline, then decide",
  },
  {
    bad: "Hides whether it actually drove any pipeline",
    good: "A dashboard that shows real pipeline against the goal you set",
  },
] as const;

export function Contrast() {
  return (
    <section id="difference" className="relative px-4 py-24">
      <SectionHeading
        eyebrow="The difference"
        title="Built against everything wrong with AI SDRs"
        subtitle="The category earned its reputation — generic spam, junk demos, torched domains, contracts you can't escape. Vantera is the opposite, by design."
      />

      <div className="mx-auto mt-14 max-w-4xl space-y-3">
        {ROWS.map((row, i) => (
          <motion.div
            key={row.good}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.5, delay: (i % 3) * 0.08 }}
            className="rounded-2xl border border-white/[0.16] bg-white/[0.06] p-5 shadow-lg shadow-black/25 sm:p-6"
          >
            <div className="grid items-center gap-4 sm:grid-cols-[1fr_auto_1fr]">
              <div className="flex items-start gap-3">
                <X className="mt-0.5 size-4 shrink-0 text-muted-foreground/50" />
                <span className="text-sm text-muted-foreground/70 line-through decoration-muted-foreground/30">
                  {row.bad}
                </span>
              </div>

              <ArrowRight className="mx-auto hidden size-4 text-foreground/40 sm:block" />

              <div className="flex items-start gap-3">
                <Check className="mt-0.5 size-4 shrink-0 text-foreground" />
                <span className="text-sm font-medium text-foreground">{row.good}</span>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
