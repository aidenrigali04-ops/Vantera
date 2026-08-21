"use client";

import { useRef } from "react";
import { useInView } from "framer-motion";
import { LandingHeading } from "@/components/landing/heading";
import { Reveal, RevealItem } from "@/components/landing/surface";
import { DeltaChip, Sparkline } from "@/components/landing/viz";
import { UseCaseGlyph } from "./icons";
import type { BenefitItem, BenefitsContent } from "./types";
import { cn } from "@/lib/utils";

/**
 * Key benefits — four outcome tiles in the hero's light-card system. Each pairs a big
 * figure with the outcome and, where it earns it, a micro-trend sparkline. The blue icon
 * well signals these are the wins (vs. the neutral wells of the problem section above).
 * One section-level in-view trigger drives every tile's sparkline (mirrors stats.tsx).
 */
export function BenefitTiles({ content }: { content: BenefitsContent }) {
  const gridRef = useRef<HTMLDivElement>(null);
  const inView = useInView(gridRef, { once: true, margin: "-100px" });

  return (
    <section className="relative border-t border-[var(--hairline)] bg-white py-24 sm:py-28">
      <div className="mx-auto max-w-6xl px-6 lg:px-8">
        <LandingHeading eyebrow={content.eyebrow} title={content.title} subtitle={content.subtitle} />

        <div ref={gridRef}>
          <Reveal className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {content.items.map((item) => (
              <BenefitCard key={item.title} item={item} run={inView} />
            ))}
          </Reveal>
        </div>
      </div>
    </section>
  );
}

function BenefitCard({ item, run }: { item: BenefitItem; run: boolean }) {
  return (
    <RevealItem
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-2xl border border-[var(--hairline)] bg-white p-6 shadow-[var(--shadow-card)]",
        "transition-all duration-300 hover:-translate-y-0.5 hover:border-[var(--cyan-line)]",
        "hover:shadow-[0_1px_2px_rgba(12,16,26,0.04),0_10px_24px_-12px_rgba(24,119,242,0.16)]",
      )}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/70 to-transparent"
      />
      <span className="grid size-11 place-items-center rounded-xl bg-[var(--cyan-tint)] text-[var(--cyan-strong)] shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] ring-1 ring-inset ring-[var(--cyan-line)] transition-transform duration-300 group-hover:scale-105">
        <UseCaseGlyph name={item.icon} className="size-5" />
      </span>

      <p className="mt-5 text-[2rem] font-semibold leading-none tracking-[-0.03em] tabular-nums text-foreground">
        {item.value}
      </p>
      <p className="mt-3 text-[14.5px] font-semibold leading-snug text-foreground">{item.title}</p>
      <p className="mt-1.5 flex-1 text-[13px] leading-relaxed text-[var(--ink-4)]">{item.body}</p>

      {item.trend && (
        <div className="mt-4 flex items-center gap-2.5 border-t border-[var(--hairline)] pt-3.5">
          <Sparkline points={item.trend} width={64} height={18} draw={run} />
          {item.delta && <DeltaChip value={item.delta} dir="up" />}
        </div>
      )}
    </RevealItem>
  );
}
