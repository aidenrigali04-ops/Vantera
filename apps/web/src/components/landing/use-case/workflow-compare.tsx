"use client";

import { motion } from "framer-motion";
import { ArrowRight, Check, X } from "lucide-react";
import { LandingHeading } from "@/components/landing/heading";
import { Reveal, RevealItem } from "@/components/landing/surface";
import type { WorkflowCompareContent } from "./types";
import { cn } from "@/lib/utils";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

/**
 * Before / after — the manual grind vs. the Vantera motion, side by side. The "before"
 * panel is muted grey with struck, x-marked steps; the "after" panel is blue-accented and
 * lifted, with checked steps and time/quality metas. A center arrow node carries the eye
 * left → right. Reduced-motion safe.
 */
export function WorkflowCompare({ content }: { content: WorkflowCompareContent }) {
  return (
    <section className="relative border-t border-[var(--hairline)] bg-[var(--tint)] py-24 sm:py-28">
      <div className="mx-auto max-w-6xl px-6 lg:px-8">
        <LandingHeading eyebrow={content.eyebrow} title={content.title} subtitle={content.subtitle} />

        <Reveal className="relative mt-14 grid items-stretch gap-5 lg:grid-cols-2 lg:gap-6">
          {/* center transition node (lg) */}
          <span
            aria-hidden
            className="absolute left-1/2 top-1/2 z-10 hidden size-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-[var(--cyan-line)] bg-white text-[var(--cyan-strong)] shadow-[var(--shadow-lift)] lg:grid"
          >
            <ArrowRight className="size-5" strokeWidth={2.4} />
          </span>

          {/* BEFORE — muted */}
          <RevealItem className="flex h-full flex-col rounded-3xl border border-[var(--hairline)] bg-[var(--tint)] p-7 shadow-[var(--shadow-sm)]">
            <div className="flex items-center gap-2.5">
              <span className="rounded-full bg-[rgba(12,16,26,0.06)] px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.1em] text-[var(--ink-4)]">
                Before
              </span>
              <span className="text-[12.5px] font-medium text-[var(--ink-4)]">{content.before.caption}</span>
            </div>
            <h3 className="mt-4 text-[19px] font-semibold tracking-[-0.02em] text-[var(--ink-2)]">
              {content.before.heading}
            </h3>

            <ul className="mt-6 flex flex-col gap-3">
              {content.before.steps.map((step, i) => (
                <motion.li
                  key={step.label}
                  className="flex items-center gap-3"
                  initial={{ opacity: 0, x: -8 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: "-60px" }}
                  transition={{ duration: 0.45, delay: i * 0.05, ease: EASE }}
                >
                  <span className="grid size-6 flex-none place-items-center rounded-full bg-[rgba(12,16,26,0.05)] text-[var(--ink-4)] ring-1 ring-inset ring-[var(--hairline)]">
                    <X className="size-3.5" strokeWidth={2.4} />
                  </span>
                  <span className="text-[14px] leading-snug text-[var(--ink-3)]">{step.label}</span>
                  {step.meta && (
                    <span className="ml-auto shrink-0 rounded-full bg-[rgba(12,16,26,0.05)] px-2 py-0.5 text-[11px] font-medium tabular-nums text-[var(--ink-4)]">
                      {step.meta}
                    </span>
                  )}
                </motion.li>
              ))}
            </ul>
          </RevealItem>

          {/* AFTER — blue, lifted */}
          <RevealItem
            className={cn(
              "relative flex h-full flex-col overflow-hidden rounded-3xl border border-[var(--cyan-line)] bg-white p-7",
              "shadow-[0_1px_2px_rgba(12,16,26,0.04),0_18px_40px_-20px_rgba(24,119,242,0.22)]",
            )}
          >
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 -z-0"
              style={{ background: "radial-gradient(60% 60% at 100% 0%, rgba(24,119,242,0.06) 0%, transparent 62%)" }}
            />
            <div className="relative flex items-center gap-2.5">
              <span className="rounded-full bg-[var(--fb)] px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.1em] text-white shadow-[0_4px_12px_-4px_rgba(24,119,242,0.35)]">
                After
              </span>
              <span className="text-[12.5px] font-medium text-[var(--cyan-strong)]">{content.after.caption}</span>
            </div>
            <h3 className="relative mt-4 text-[19px] font-semibold tracking-[-0.02em] text-foreground">
              {content.after.heading}
            </h3>

            <ul className="relative mt-6 flex flex-col gap-3">
              {content.after.steps.map((step, i) => (
                <motion.li
                  key={step.label}
                  className="flex items-center gap-3"
                  initial={{ opacity: 0, x: 8 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: "-60px" }}
                  transition={{ duration: 0.45, delay: i * 0.05, ease: EASE }}
                >
                  <span className="grid size-6 flex-none place-items-center rounded-full bg-[var(--cyan-tint)] text-[var(--cyan-strong)] ring-1 ring-inset ring-[var(--cyan-line)]">
                    <Check className="size-3.5" strokeWidth={2.6} />
                  </span>
                  <span className="text-[14px] font-medium leading-snug text-foreground">{step.label}</span>
                  {step.meta && (
                    <span className="ml-auto shrink-0 rounded-full bg-[var(--fb-tint)] px-2 py-0.5 text-[11px] font-semibold tabular-nums text-[var(--cyan-strong)] ring-1 ring-inset ring-[var(--cyan-line)]">
                      {step.meta}
                    </span>
                  )}
                </motion.li>
              ))}
            </ul>
          </RevealItem>
        </Reveal>
      </div>
    </section>
  );
}
