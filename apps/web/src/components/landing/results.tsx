"use client";

import { motion } from "framer-motion";
import { LandingHeading } from "./heading";

/**
 * "AI that drives results" — honest design facts, not fabricated customer metrics.
 * Each number is a real property of the system (the score bar, 1:1 personalization,
 * human-approved sends, zero manual research). Flat, near-black numerals.
 */
const STATS = [
  { value: "70+", label: "Score floor to be pursued", caption: "Below the bar never gets touched" },
  { value: "1:1", label: "Personalization, every message", caption: "Written from real activity, never a template" },
  { value: "100%", label: "Of sends you approve", caption: "Nothing goes out without your sign-off" },
  { value: "0", label: "Manual research", caption: "Sourcing, scoring & enrichment run themselves" },
];

export function Results() {
  return (
    <section id="results" className="relative py-24 sm:py-28">
      <div className="mx-auto max-w-6xl px-6 lg:px-8">
        <LandingHeading
          eyebrow="The outcome"
          title="AI that drives results"
          subtitle="Quality is enforced by the system, not promised by a salesperson. These are the guarantees built into every run."
        />

        <div className="mt-14 grid divide-y divide-[var(--hairline)] overflow-hidden rounded-2xl border border-[var(--hairline)] bg-white sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4 lg:divide-x">
          {STATS.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
              className="p-7 [&:nth-child(2)]:border-t [&:nth-child(2)]:border-[var(--hairline)] sm:[&:nth-child(2)]:border-t-0"
            >
              <p className="text-[2.75rem] font-semibold leading-none tracking-[-0.03em] text-foreground">
                {s.value}
              </p>
              <p className="mt-3 text-[14px] font-semibold text-foreground">{s.label}</p>
              <p className="mt-1 text-[12.5px] leading-snug text-[var(--ink-4)]">{s.caption}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
