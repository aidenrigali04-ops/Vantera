"use client";

import { LandingHeading } from "@/components/landing/heading";
import { Reveal, RevealItem, CARD_INTERACTIVE } from "@/components/landing/surface";
import { UseCaseGlyph } from "./icons";
import type { ProblemContent } from "./types";
import { cn } from "@/lib/utils";

/**
 * Problem section — names the status quo before offering the fix. Deliberately monochrome:
 * the icon wells are NEUTRAL grey (not the reserved blue) so "problems" read cool and the
 * blue solution sections that follow feel like relief. Each card pairs the pain with the
 * quantified cost of leaving it alone, and a kicker bridges to Vantera.
 */
export function ProblemSection({ content }: { content: ProblemContent }) {
  return (
    <section className="relative border-t border-[var(--hairline)] bg-white py-24 sm:py-28">
      <div className="mx-auto max-w-6xl px-6 lg:px-8">
        <LandingHeading eyebrow={content.eyebrow} title={content.title} subtitle={content.subtitle} />

        <Reveal className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {content.items.map((item) => {
            return (
              <RevealItem
                key={item.title}
                className={cn(CARD_INTERACTIVE, "group flex h-full flex-col p-6")}
              >
                <span className="grid size-11 place-items-center rounded-xl bg-[rgba(12,16,26,0.05)] text-[var(--ink-3)] ring-1 ring-inset ring-[var(--hairline)] transition-colors duration-300 group-hover:text-[var(--ink-2)]">
                  <UseCaseGlyph name={item.icon} className="size-5" />
                </span>

                <h3 className="mt-5 text-[15.5px] font-semibold leading-snug tracking-[-0.01em] text-foreground">
                  {item.title}
                </h3>
                <p className="mt-2 flex-1 text-[13.5px] leading-relaxed text-[var(--ink-3)]">{item.body}</p>

                <div className="mt-5 flex items-baseline gap-2 border-t border-[var(--hairline)] pt-4">
                  <span className="text-[1.5rem] font-semibold leading-none tracking-[-0.03em] text-[var(--ink-2)] tabular-nums">
                    {item.costValue}
                  </span>
                  <span className="text-[12px] font-medium leading-tight text-[var(--ink-4)]">{item.costLabel}</span>
                </div>
              </RevealItem>
            );
          })}
        </Reveal>

        <p className="mx-auto mt-12 flex max-w-2xl items-center justify-center gap-2.5 text-center text-[15px] font-medium text-[var(--ink-2)] sm:text-[16px]">
          <span className="size-1.5 shrink-0 rounded-full bg-[var(--cyan)]" />
          {content.kicker}
        </p>
      </div>
    </section>
  );
}
