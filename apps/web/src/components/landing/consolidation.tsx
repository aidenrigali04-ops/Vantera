"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Search, PenLine, ListOrdered, ShieldCheck, Inbox } from "lucide-react";
import { LandingHeading } from "./heading";
import { Reveal, RevealItem, CARD, CARD_INTERACTIVE } from "./surface";
import { cn } from "@/lib/utils";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

/**
 * Consolidation — "One platform. Replaces your whole outbound stack."
 *
 * A flat, geometric orbit: a central Vantera node with the five tools it replaces
 * arranged around it, each a labeled chip joined to the center by a thin hairline
 * connector. Deliberately NO glow (unlike the hero) — clean lines, hairline borders,
 * the reserved blue accent only as a signature on the connectors/center dot.
 * Reduced-motion safe: the orbit reveals in place with no drift under reduced motion.
 */

type Node = {
  label: string;
  sub: string;
  icon: typeof Search;
  /** Position on the orbit ring, in degrees clockwise from 12 o'clock. */
  angle: number;
};

// Ordered around the ring: the outbound stack, first touch → reply.
const NODES: Node[] = [
  { label: "Lead finding", sub: "List tool", icon: Search, angle: 0 },
  { label: "Copywriting", sub: "AI writer", icon: PenLine, angle: 72 },
  { label: "Sequencing", sub: "Cadence app", icon: ListOrdered, angle: 144 },
  { label: "Safety / pacing", sub: "Warmup + limits", icon: ShieldCheck, angle: 216 },
  { label: "Inbox", sub: "Reply manager", icon: Inbox, angle: 288 },
];

/* ── Orbit geometry (viewBox units) ──────────────────────────────────────────
   A 100×100 square viewBox; connectors are drawn in SVG, the center + chips are
   absolutely positioned in % so they stay crisp text at any size. */
const CENTER = 50;
const RING = 38; // chip distance from center
const HUB_R = 15.5; // where a connector meets the central node's edge

function polar(angle: number, r: number) {
  const rad = ((angle - 90) * Math.PI) / 180;
  return { x: CENTER + r * Math.cos(rad), y: CENTER + r * Math.sin(rad) };
}

export function Consolidation() {
  const reduce = useReducedMotion();

  return (
    <section className="relative border-t border-[var(--hairline)] bg-[var(--tint)] py-24 sm:py-28 lg:py-32">
      <div className="mx-auto max-w-6xl px-6 lg:px-8">
        <LandingHeading
          eyebrow="One platform"
          title="Replace your entire outbound stack"
          subtitle="No more stitching a lead-list tool to a sequencer to a separate inbox to safety tooling that all half-talk to each other. Vantera runs the whole motion, end to end."
        />

        <div className="mt-16 grid items-center gap-14 lg:mt-20 lg:grid-cols-[1.05fr_1fr] lg:gap-20">
          {/* LEFT — the "before" ledger: the stack Vantera absorbs. */}
          <Reveal className="order-2 flex flex-col gap-3.5 lg:order-1">
            {NODES.map((n) => (
              <RevealItem
                key={n.label}
                className={cn(
                  CARD_INTERACTIVE,
                  // hero-calendar inner highlight so each row reads as a lifted panel, not a flat strip
                  "group flex items-center gap-4 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.7),var(--shadow-card)]",
                )}
              >
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[var(--cyan-tint)] text-[var(--cyan-strong)] ring-1 ring-inset ring-[var(--cyan-line)] transition-transform duration-300 group-hover:scale-[1.04]">
                  <n.icon className="size-5" strokeWidth={1.9} />
                </span>
                <div className="min-w-0">
                  <p className="text-[15px] font-semibold tracking-[-0.01em] text-foreground">
                    {n.label}
                  </p>
                  <p className="text-[13px] text-[var(--ink-4)]">Was: a separate {n.sub.toLowerCase()}</p>
                </div>
                <span className="ml-auto flex shrink-0 items-center gap-1.5 rounded-full bg-[var(--cyan-tint)] py-1 pl-2 pr-2.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--cyan-strong)] ring-1 ring-inset ring-[var(--cyan-line)]">
                  <span className="size-1.5 rounded-full bg-[var(--cyan)]" />
                  Built in
                </span>
              </RevealItem>
            ))}
          </Reveal>

          {/* RIGHT — the flat orbit. */}
          <motion.div
            initial={{ opacity: 0, y: reduce ? 0 : 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-90px" }}
            transition={{ duration: 0.8, ease: EASE }}
            className="order-1 lg:order-2"
          >
            <OrbitCluster reduce={!!reduce} />
          </motion.div>
        </div>

        {/* Supporting line under the visual. */}
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-90px" }}
          transition={{ duration: 0.6, ease: EASE, delay: 0.05 }}
          className="mx-auto mt-14 flex max-w-xl items-center justify-center gap-2.5 text-center text-[15px] font-medium text-[var(--ink-2)] sm:text-[16px]"
        >
          <span className="size-1.5 shrink-0 rounded-full bg-[var(--cyan)]" />
          One system, from first touch to booked meeting.
        </motion.p>
      </div>
    </section>
  );
}

/* ── The orbit mockup — flat, geometric, hairline connectors, no glow. ──────── */
function OrbitCluster({ reduce }: { reduce: boolean }) {
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[440px]">
      {/* Thin geometric connectors + guide ring, drawn behind the chips. */}
      <svg
        viewBox="0 0 100 100"
        className="absolute inset-0 h-full w-full"
        fill="none"
        aria-hidden
      >
        {/* faint guide ring the chips sit on */}
        <circle cx={CENTER} cy={CENTER} r={RING} stroke="var(--hairline)" strokeWidth={0.3} />

        {NODES.map((n, i) => {
          const from = polar(n.angle, HUB_R);
          const to = polar(n.angle, RING - 7.5);
          return (
            <g key={n.label}>
              {/* hairline spoke, hub → chip */}
              <motion.line
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                stroke="var(--cyan-line)"
                strokeWidth={0.45}
                strokeLinecap="round"
                initial={reduce ? false : { pathLength: 0, opacity: 0 }}
                whileInView={reduce ? undefined : { pathLength: 1, opacity: 1 }}
                viewport={{ once: true, margin: "-90px" }}
                transition={{ duration: 0.6, ease: EASE, delay: 0.35 + i * 0.08 }}
              />
              {/* crisp node point where the spoke meets the chip — white halo keeps it clean on the ring */}
              <circle cx={to.x} cy={to.y} r={1.35} fill="#fff" stroke="var(--cyan-line)" strokeWidth={0.3} />
              <circle cx={to.x} cy={to.y} r={0.85} fill="var(--cyan)" />
            </g>
          );
        })}
      </svg>

      {/* Central Vantera node — flat card, hairline border, no halo. */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <div
          className={cn(
            CARD,
            // hero-calendar inner highlight for a crisp lifted center node (still flat — no glow)
            "flex flex-col items-center gap-1.5 px-5 py-4 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.7),var(--shadow-card)]",
          )}
        >
          <span className="grid size-8 place-items-center rounded-lg bg-foreground text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.14)]">
            <VanteraGlyph className="size-4" />
          </span>
          <span className="text-[14px] font-semibold tracking-[-0.01em] text-foreground">
            Vantera
          </span>
          <span className="inline-flex items-center gap-1.5 text-[10.5px] font-medium uppercase tracking-[0.1em] text-[var(--ink-4)]">
            <span className="size-1 rounded-full bg-[var(--cyan)]" />
            One system
          </span>
        </div>
      </div>

      {/* Orbiting tool chips. */}
      {NODES.map((n, i) => {
        const p = polar(n.angle, RING);
        return (
          <motion.div
            key={n.label}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${p.x}%`, top: `${p.y}%` }}
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.8 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, margin: "-90px" }}
            transition={
              reduce
                ? { duration: 0.4, delay: 0.2 + i * 0.06 }
                : { type: "spring", stiffness: 420, damping: 26, delay: 0.3 + i * 0.08 }
            }
          >
            <div
              className={cn(
                CARD,
                "flex items-center gap-2 whitespace-nowrap px-2.5 py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.7),var(--shadow-sm)]",
              )}
            >
              <span className="grid size-6 shrink-0 place-items-center rounded-md bg-[var(--cyan-tint)] text-[var(--cyan-strong)] ring-1 ring-inset ring-[var(--cyan-line)]">
                <n.icon className="size-3.5" strokeWidth={2} />
              </span>
              <span className="text-[11.5px] font-semibold tracking-[-0.01em] text-[var(--ink-2)]">
                {n.label}
              </span>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

/* Compact Vantera "V" glyph for the central node (matches the mono product mark). */
function VanteraGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M4.5 5.5 12 18.5 19.5 5.5"
        stroke="currentColor"
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
