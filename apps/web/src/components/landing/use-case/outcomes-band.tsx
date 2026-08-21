"use client";

import { useRef } from "react";
import { useInView } from "framer-motion";
import { Star } from "lucide-react";
import { useCountUp } from "@/components/landing/viz";
import type { OutcomeMetric, OutcomesContent } from "./types";

/**
 * Customer outcomes — the ONE dark section, using the landing's dark product-panel tokens
 * (`--panel`, `--panel-glow`) where cyan is allowed to glow. Big count-up figures over a
 * near-black glassy panel introduce a fresh visual key mid-page, then a testimonial closes
 * it. Figures are directional/illustrative (see page copy); the panel is decorative.
 *
 * NOTE (dev): the quote is a placeholder — swap in a real, attributed story as it lands.
 */
export function OutcomesBand({ content }: { content: OutcomesContent }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section className="relative border-t border-[var(--hairline)] bg-white py-24 sm:py-28">
      <div className="mx-auto max-w-6xl px-6 lg:px-8">
        <div
          ref={ref}
          className="relative overflow-hidden rounded-[28px] border border-white/10 p-8 sm:p-12"
          style={{ background: "var(--panel)", boxShadow: "var(--panel-glow)" }}
        >
          {/* interior cyan glow — the panel's one permitted glow */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(50% 60% at 82% 0%, rgba(48,207,255,0.14) 0%, transparent 60%), radial-gradient(46% 60% at 6% 100%, rgba(24,119,242,0.12) 0%, transparent 58%)",
            }}
          />

          <div className="relative">
            {/* heading */}
            <div className="max-w-2xl">
              <span className="block text-[12.5px] font-semibold uppercase tracking-[0.18em] text-[#57c7ff]">
                {content.eyebrow}
              </span>
              <h2 className="mt-4 text-[2.05rem] font-semibold leading-[1.08] tracking-[-0.035em] text-white sm:text-[2.6rem]">
                {content.title}
              </h2>
              <p className="mt-4 max-w-xl text-[15.5px] leading-relaxed text-white/60 sm:text-[16.5px]">
                {content.subtitle}
              </p>
            </div>

            {/* metrics */}
            <div className="mt-10 grid gap-x-6 gap-y-8 border-t border-white/10 pt-9 sm:grid-cols-2 lg:grid-cols-4">
              {content.metrics.map((m) => (
                <MetricBlock key={m.label} metric={m} run={inView} />
              ))}
            </div>

            {/* testimonial */}
            <figure className="mt-10 flex flex-col gap-5 border-t border-white/10 pt-9 sm:flex-row sm:items-start sm:gap-6">
              <div className="flex items-center gap-1 sm:mt-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="size-[15px] fill-[#57c7ff] text-[#57c7ff]" strokeWidth={0} />
                ))}
              </div>
              <div className="min-w-0">
                <blockquote className="text-pretty text-[17px] font-medium leading-relaxed tracking-[-0.005em] text-white/90 sm:text-[18.5px]">
                  &ldquo;{content.quote.text}&rdquo;
                </blockquote>
                <figcaption className="mt-4 flex items-center gap-3">
                  <span className="grid size-10 flex-none place-items-center rounded-full bg-white/10 text-[13px] font-semibold text-white ring-1 ring-inset ring-white/15">
                    {content.quote.initials}
                  </span>
                  <span className="leading-tight">
                    <span className="block text-[14.5px] font-semibold tracking-[-0.01em] text-white">
                      {content.quote.name}
                    </span>
                    <span className="block text-[13px] text-white/55">
                      {content.quote.role} · {content.quote.company}
                    </span>
                  </span>
                </figcaption>
              </div>
            </figure>
          </div>
        </div>
      </div>
    </section>
  );
}

function MetricBlock({ metric, run }: { metric: OutcomeMetric; run: boolean }) {
  const value = useCountUp(metric.value, run, metric.decimals ?? 0);
  return (
    <div className="relative">
      <p className="flex items-baseline font-mono text-[2.4rem] font-semibold leading-none tracking-[-0.04em] tabular-nums text-white sm:text-[2.7rem]">
        {metric.prefix}
        {value}
        {metric.suffix && <span className="ml-0.5 text-[0.5em] font-semibold text-[#57c7ff]">{metric.suffix}</span>}
      </p>
      <p className="mt-3 text-[13.5px] font-semibold leading-snug text-white/85">{metric.label}</p>
      <p className="mt-1 text-[12px] leading-snug text-white/45">{metric.caption}</p>
    </div>
  );
}
