import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { FinalCtaContent } from "./types";

/**
 * Use-case closing band — the conversion moment. Near-black heading on a tinted canvas with
 * one restrained on-palette blue pool, an opportunity-cost line (the reader should feel the
 * cost of NOT acting), a primary + secondary CTA, and a reassurance row. Server component.
 */
export function UseCaseFinalCta({ content }: { content: FinalCtaContent }) {
  return (
    <section className="relative border-t border-[var(--hairline)] bg-[var(--tint)] py-24 sm:py-28 lg:py-32">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(50% 44% at 50% 4%, rgba(24,119,242,0.08) 0%, transparent 62%)" }}
      />

      <div className="relative mx-auto max-w-3xl px-6 text-center lg:px-8">
        <span className="block text-[12.5px] font-semibold uppercase tracking-[0.18em] text-[var(--cyan-strong)]">
          {content.eyebrow}
        </span>
        <h2 className="mx-auto mt-6 max-w-2xl text-[2.2rem] font-semibold leading-[1.08] tracking-[-0.035em] text-foreground sm:text-[2.8rem] lg:text-[3.1rem]">
          {content.title}
        </h2>
        <p className="mx-auto mt-6 max-w-xl text-[16px] leading-relaxed text-[var(--ink-3)] sm:text-[17.5px]">
          {content.urgency}
        </p>

        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <Link
            href={content.primaryCta.href}
            className="group inline-flex items-center gap-2 rounded-full bg-[var(--fb)] px-8 py-3.5 text-[15px] font-semibold text-white shadow-[0_6px_18px_-8px_rgba(24,119,242,0.4)] transition-all hover:bg-[var(--fb-strong)] hover:-translate-y-0.5 hover:shadow-[0_12px_28px_-12px_rgba(24,119,242,0.45)] active:scale-[0.98]"
          >
            {content.primaryCta.label}
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
          <Link
            href={content.secondaryCta.href}
            className="inline-flex items-center gap-2 rounded-full border border-[var(--hairline)] bg-white px-8 py-3.5 text-[15px] font-semibold text-[var(--ink-2)] shadow-[var(--shadow-sm)] transition-all hover:-translate-y-0.5 hover:border-[var(--cyan-line)] hover:text-foreground"
          >
            {content.secondaryCta.label}
          </Link>
        </div>

        <p className="mt-6 flex flex-wrap items-center justify-center gap-x-1.5 text-[13px] font-medium text-[var(--ink-4)]">
          {content.reassurance.map((r, i) => (
            <span key={r} className="inline-flex items-center gap-1.5">
              {i > 0 && <span className="text-[var(--cyan-line)]">·</span>}
              {r}
            </span>
          ))}
        </p>
      </div>
    </section>
  );
}
