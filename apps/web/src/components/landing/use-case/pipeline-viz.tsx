"use client";

import { motion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import { LandingHeading } from "@/components/landing/heading";
import { Reveal, RevealItem } from "@/components/landing/surface";
import { UseCaseGlyph } from "./icons";
import type { PipelineContent } from "./types";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

/**
 * AI workflow visualization — the end-to-end motion as a node rail. On lg the eight nodes
 * sit on a single flowing connector (the shared `vc-flow` dashed-stroke animation, reduced-
 * motion-safe); below lg they wrap to a 2/4-up grid with chevrons implied by order. Each
 * node carries a blue icon well, its stage, a one-line, and a metric. Approval sits mid-
 * rail as the accent node so "you stay in control" reads visually.
 */
export function PipelineViz({ content }: { content: PipelineContent }) {
  return (
    <section id="how-it-works" className="relative border-t border-[var(--hairline)] bg-[var(--tint)] py-24 sm:py-28">
      <div className="mx-auto max-w-6xl px-6 lg:px-8">
        <LandingHeading eyebrow={content.eyebrow} title={content.title} subtitle={content.subtitle} />

        <Reveal className="relative mt-16">
          {/* flowing connector behind the row (lg only), aligned to the icon-well center */}
          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-[26px] hidden lg:block">
            <svg className="mx-auto h-2 w-[calc(100%-3rem)]" viewBox="0 0 100 2" preserveAspectRatio="none">
              <line x1="0" y1="1" x2="100" y2="1" stroke="var(--hairline)" strokeWidth="0.4" />
              <line
                className="vc-flow-line"
                x1="0"
                y1="1"
                x2="100"
                y2="1"
                stroke="var(--cyan)"
                strokeWidth="0.7"
                strokeDasharray="3 5"
                strokeLinecap="round"
                opacity="0.85"
              />
            </svg>
          </div>

          <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-4 lg:grid-cols-8 lg:gap-x-2">
            {content.nodes.map((node, i) => {
              const accent = node.label === "Approve";
              return (
                <RevealItem key={node.label} className="relative flex flex-col items-center text-center">
                  <span
                    className={
                      accent
                        ? "relative z-10 grid size-[52px] place-items-center rounded-2xl bg-[var(--fb)] text-white shadow-[0_10px_24px_-10px_rgba(24,119,242,0.6)] ring-1 ring-inset ring-white/20"
                        : "relative z-10 grid size-[52px] place-items-center rounded-2xl border border-[var(--cyan-line)] bg-white text-[var(--cyan-strong)] shadow-[inset_0_1px_0_rgba(255,255,255,0.7),var(--shadow-card)]"
                    }
                  >
                    <UseCaseGlyph name={node.icon} className="size-6" />
                  </span>

                  <span className="mt-3.5 inline-flex items-center gap-1 text-[13.5px] font-semibold tracking-[-0.01em] text-foreground">
                    <span className="font-mono text-[10px] tabular-nums text-[var(--ink-4)]">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    {node.label}
                  </span>
                  <span className="mt-1 text-[11.5px] leading-snug text-[var(--ink-3)]">{node.line}</span>
                  <span className="mt-2 rounded-full bg-[var(--cyan-tint)] px-2 py-0.5 text-[10px] font-semibold tracking-[0.01em] text-[var(--cyan-strong)] ring-1 ring-inset ring-[var(--cyan-line)]">
                    {node.metric}
                  </span>

                  {/* mobile/tablet flow chevron between nodes */}
                  {i < content.nodes.length - 1 && (
                    <ChevronRight
                      aria-hidden
                      className="absolute -right-2.5 top-[18px] size-4 text-[var(--ink-4)] lg:hidden"
                      strokeWidth={2.2}
                    />
                  )}
                </RevealItem>
              );
            })}
          </div>
        </Reveal>

        <motion.p
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6, ease: EASE }}
          className="mx-auto mt-14 flex max-w-xl items-center justify-center gap-2.5 text-center text-[15px] font-medium text-[var(--ink-2)]"
        >
          <span className="size-1.5 shrink-0 rounded-full bg-[var(--cyan)]" />
          One system, from in-market signal to a meeting on the calendar.
        </motion.p>
      </div>
    </section>
  );
}
