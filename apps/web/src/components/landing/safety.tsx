"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Activity, ArrowRight, Gauge, Lock } from "lucide-react";
import { Reveal, RevealItem } from "./surface";
import { MarkOnBlue, PixelField, SectionIntro } from "./section-intro";
import { CEILING_FACT } from "./claims";

/**
 * S3 · Safety (03/05) — "Will this get my account restricted?" For this audience the
 * section that converts harder than any feature. Three MechanismCards, each ending in
 * a mono fact line with the REAL numbers (rules 04/11: ~100 invites/week, warmup ramp,
 * auto-pause) — specificity is the trust device, not superlatives. Ghost link → /safety.
 */

const MECHANISMS = [
  {
    icon: Lock,
    title: "Your login never touches Vantera.",
    body: "You sign in through LinkedIn's own flow. Vantera receives a connection — never your password.",
    fact: "Stored by Vantera: nothing",
  },
  {
    icon: Gauge,
    title: "Sends at human speed, inside hard ceilings.",
    body: "A hard weekly ceiling, randomized gaps, human pacing. No setting can push past the safe line.",
    fact: `Ceiling: ${CEILING_FACT} · not configurable above it`,
  },
  {
    icon: Activity,
    title: "New accounts ramp. Trouble pauses everything.",
    body: "New accounts ramp up gradually. A security check pauses everything until you've resolved it.",
    fact: "Warmup: gradual weekly ramp · auto-pause on checks",
  },
];

export function Safety() {
  return (
    <section id="safety" className="relative bg-white py-10 sm:py-14">
      <div className="mx-auto max-w-6xl px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-[28px] px-6 py-12 sm:px-10 sm:py-14 lg:px-14 lg:py-16 [background:linear-gradient(180deg,#1877f2_0%,#1468da_74%,#1163d2_100%)]">
        <PixelField />
        <div className="relative">
        <SectionIntro
          onBlue
          align="center"
          index="03"
          label="Account safety"
          title={
            <>
              Built to keep your account <MarkOnBlue>safe</MarkOnBlue> — not just fast.
            </>
          }
          lead="Ceilings, pacing, and warmup are fixed in the scheduler — not for sale."
        />

        <Reveal className="mt-14 grid gap-5 lg:grid-cols-3">
          {MECHANISMS.map((m) => (
            <RevealItem
              key={m.title}
              className="flex h-full flex-col rounded-2xl bg-white p-6 shadow-[inset_0_1px_0_rgba(255,255,255,.7),0_2px_6px_rgba(3,22,58,.16),0_28px_56px_-24px_rgba(3,22,58,.5)]"
            >
              <span className="grid size-10 place-items-center rounded-xl bg-[var(--cyan-tint)] text-[var(--cyan-strong)] ring-1 ring-inset ring-[var(--cyan-line)]">
                <m.icon className="size-5" strokeWidth={1.9} />
              </span>
              <h3 className="mt-5 text-[17.5px] font-semibold leading-snug tracking-[-0.015em] text-foreground">
                {m.title}
              </h3>
              <p className="mt-2.5 flex-1 text-[14px] leading-relaxed text-[var(--ink-3)]">{m.body}</p>
              <p className="mt-5 flex items-center gap-2 border-t border-[var(--hairline)] pt-3.5 font-mono text-[11.5px] tracking-[0.02em] text-[var(--cyan-strong)]">
                <span className="size-1.5 shrink-0 rounded-full bg-[var(--fb)]" aria-hidden />
                {m.fact}
              </p>
            </RevealItem>
          ))}
        </Reveal>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.6 }}
          className="mt-12 flex flex-col items-center gap-3 text-center"
        >
          <Link
            href="/safety"
            className="group inline-flex items-center gap-2 rounded-full border border-white/35 bg-white/10 px-5 py-2.5 text-[14px] font-semibold text-white backdrop-blur transition-colors hover:bg-white/15"
          >
            How pacing works
            <ArrowRight
              className="size-3.5 transition-transform duration-200 group-hover:translate-x-0.5"
              strokeWidth={2.4}
            />
          </Link>
          <p className="max-w-lg text-[13px] leading-relaxed text-white/70">
            Ceilings can&rsquo;t be raised — not by you, not by us.
          </p>
        </motion.div>
        </div>
        </div>
      </div>
    </section>
  );
}
