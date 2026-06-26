"use client";

import { LandingHeading } from "./heading";
import { Reveal, RevealItem, CARD_INTERACTIVE } from "./surface";
import { cn } from "@/lib/utils";

/**
 * Honesty contract: no fabricated customer quotes. This is a "promise wall" — the real
 * guarantees that define how Vantera works, in the testimonial-grid rhythm. Swap in
 * real, attributed testimonials here when they exist.
 */
const PROMISES = [
  { label: "The bar", text: "Only leads that clear the bar get touched. Below 70, a message never sends." },
  { label: "The voice", text: "Every message is written from real activity — never a template, never a {{first_name}}." },
  { label: "The control", text: "You approve every send. Vantera drafts, you decide. Always." },
  { label: "The safety", text: "Outreach paces like a human and stays inside LinkedIn's limits — your account stays safe." },
  { label: "The follow-through", text: "Replies never sit. Every response is surfaced and classified the moment it lands." },
  { label: "The handoff", text: "Closed deals push straight into your CRM. Vantera hands off — it never becomes another inbox." },
];

export function Testimonials() {
  return (
    <section className="relative border-t border-[var(--hairline)] bg-[var(--tint)] py-24 sm:py-28">
      <div className="mx-auto max-w-6xl px-6 lg:px-8">
        <LandingHeading
          eyebrow="The promise"
          title="Built for revenue, not vanity metrics"
          subtitle="No fluff and no fake reviews — just the guarantees that make Vantera safe to run on your own LinkedIn."
        />

        <Reveal className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PROMISES.map((p) => (
            <RevealItem key={p.label} className={cn(CARD_INTERACTIVE, "flex flex-col justify-between p-6")}>
              <blockquote className="text-[16px] font-medium leading-relaxed text-foreground">{p.text}</blockquote>
              <figcaption className="mt-5 inline-flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.1em] text-[var(--cyan-strong)]">
                <span className="h-px w-5 bg-[var(--cyan-strong)]/40" />
                {p.label}
              </figcaption>
            </RevealItem>
          ))}
        </Reveal>
      </div>
    </section>
  );
}
