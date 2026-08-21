import Link from "next/link";
import { ArrowRight } from "lucide-react";

/**
 * Shared glossary CTA band — the tasteful conversion moment used on the hub and on each
 * term page. Near-black heading on tint with one restrained blue pool; two clear CTAs, no
 * fake newsletter backend. Server component.
 */
export function GlossaryCta({
  title = "Stop reading about outreach. Start booking meetings.",
  subtitle = "Vantera runs the whole LinkedIn motion — finds in-market buyers, qualifies them, and drafts every message from real activity. You approve every send.",
}: {
  title?: string;
  subtitle?: string;
}) {
  return (
    <section className="relative border-t border-[var(--hairline)] bg-[var(--tint)] py-20 sm:py-24">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(50% 44% at 50% 4%, rgba(24,119,242,0.08) 0%, transparent 62%)" }}
      />
      <div className="relative mx-auto max-w-2xl px-6 text-center lg:px-8">
        <h2 className="mx-auto max-w-xl text-[1.9rem] font-semibold leading-[1.1] tracking-[-0.03em] text-foreground sm:text-[2.4rem]">
          {title}
        </h2>
        <p className="mx-auto mt-5 max-w-lg text-[15.5px] leading-relaxed text-[var(--ink-3)] sm:text-[16.5px]">
          {subtitle}
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/signup"
            className="group inline-flex items-center gap-2 rounded-full bg-[var(--fb)] px-7 py-3.5 text-[15px] font-semibold text-white shadow-[0_6px_18px_-8px_rgba(24,119,242,0.4)] transition-all hover:bg-[var(--fb-strong)] hover:-translate-y-0.5"
          >
            Start free
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
          <Link
            href="/#pricing"
            className="inline-flex items-center gap-2 rounded-full border border-[var(--hairline)] bg-white px-7 py-3.5 text-[15px] font-semibold text-[var(--ink-2)] shadow-[var(--shadow-sm)] transition-all hover:-translate-y-0.5 hover:border-[var(--cyan-line)] hover:text-foreground"
          >
            See pricing
          </Link>
        </div>
      </div>
    </section>
  );
}
