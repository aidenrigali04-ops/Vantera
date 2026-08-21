"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Search, TrendingUp } from "lucide-react";
import { useCountUp } from "@/components/landing/viz";
import type { GlossaryTerm } from "@/lib/glossary";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

/**
 * Glossary hero — a centered, premium opener: a word-stagger animated headline, a large
 * Spotlight-style search trigger (opens the ⌘K palette), popular searches, trending pills,
 * and honest count-up statistics. Background is the landing's restrained blue radial wash —
 * no heavy particle canvas, consistent with the other marketing surfaces.
 */
export function GlossaryHero({
  onOpenSearch,
  stats,
  popular,
  trending,
}: {
  onOpenSearch: (query?: string) => void;
  stats: { terms: number; categories: number };
  popular: string[];
  trending: GlossaryTerm[];
}) {
  const [isMac, setIsMac] = useState(true);
  useEffect(() => {
    const id = requestAnimationFrame(() =>
      setIsMac(/mac/i.test(navigator.platform) || /mac/i.test(navigator.userAgent)),
    );
    return () => cancelAnimationFrame(id);
  }, []);

  const headline = ["The", "language", "of", "modern", "growth"];

  return (
    <section className="relative overflow-hidden pt-36 pb-14 sm:pt-40 lg:pt-44">
      {/* restrained blue ambience */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(52% 46% at 50% -4%, rgba(24,119,242,0.14) 0%, transparent 60%), radial-gradient(38% 40% at 84% 0%, rgba(24,119,242,0.07) 0%, transparent 58%)",
        }}
      />

      <div className="mx-auto max-w-3xl px-6 text-center lg:px-8">
        <motion.span
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE }}
          className="inline-flex items-center gap-2 rounded-full border border-[var(--hairline)] bg-white px-3 py-1.5 text-[12px] font-semibold uppercase tracking-[0.14em] text-[var(--cyan-strong)] shadow-[var(--shadow-sm)]"
        >
          <span className="size-1.5 rounded-full bg-[var(--cyan)]" />
          Resources &amp; Glossary
        </motion.span>

        {/* word-stagger headline */}
        <h1 className="mx-auto mt-6 max-w-2xl text-[2.6rem] font-semibold leading-[1.08] tracking-[-0.04em] text-foreground sm:text-[3.3rem] lg:text-[3.6rem]">
          {headline.map((word, i) => (
            <motion.span
              key={i}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.08 + i * 0.07, ease: EASE }}
              className="inline-block"
            >
              {word === "growth" ? (
                <span className="relative inline-block rounded-[12px] px-2.5 pb-[0.1em] pt-[0.02em] text-white shadow-[0_12px_30px_-10px_rgba(24,119,242,0.6)] [background:linear-gradient(180deg,#2a82f7_0%,#1877f2_56%,#166fe5_100%)]">
                  {word}
                </span>
              ) : (
                word
              )}
              {i < headline.length - 1 ? " " : ""}
            </motion.span>
          ))}
        </h1>

        <motion.p
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4, ease: EASE }}
          className="mx-auto mt-5 max-w-xl text-[16.5px] leading-relaxed text-[var(--ink-3)] sm:text-[18px]"
        >
          The definitive glossary for LinkedIn, sales, cold outreach, SEO, and AI search — clear,
          citable definitions for the terms modern growth teams actually use.
        </motion.p>

        {/* Spotlight-style search trigger */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5, ease: EASE }}
          className="mx-auto mt-9 max-w-xl"
        >
          <button
            type="button"
            onClick={() => onOpenSearch("")}
            className="group flex w-full items-center gap-3 rounded-2xl border border-[var(--hairline)] bg-white py-3.5 pl-5 pr-3 text-left shadow-[var(--shadow-card)] transition-all hover:-translate-y-0.5 hover:border-[var(--cyan-line)] hover:shadow-[var(--shadow-lift)]"
          >
            <Search className="size-5 shrink-0 text-[var(--ink-4)] transition-colors group-hover:text-[var(--cyan-strong)]" />
            <span className="min-w-0 flex-1 truncate text-[15px] text-[var(--ink-4)]">
              Search the glossary…
            </span>
            <kbd className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-[var(--hairline)] bg-[var(--tint)] px-2 py-1 font-mono text-[11.5px] font-medium text-[var(--ink-3)]">
              {isMac ? "⌘" : "Ctrl"} K
            </kbd>
          </button>

          {/* popular searches */}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <span className="text-[12.5px] font-medium text-[var(--ink-4)]">Popular:</span>
            {popular.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => onOpenSearch(p)}
                className="rounded-full border border-[var(--hairline)] bg-white px-3 py-1 text-[12.5px] font-medium text-[var(--ink-2)] shadow-[var(--shadow-sm)] transition-all hover:-translate-y-0.5 hover:border-[var(--cyan-line)] hover:text-[var(--cyan-strong)]"
              >
                {p}
              </button>
            ))}
          </div>
        </motion.div>

        {/* live stats */}
        <motion.dl
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.62, ease: EASE }}
          className="mx-auto mt-11 grid max-w-lg grid-cols-2 gap-x-6 gap-y-6 sm:grid-cols-4"
        >
          <Stat value={stats.terms} suffix="+" label="Terms" />
          <Stat value={stats.categories} label="Categories" />
          <StaticStat value="Weekly" label="Updated" />
          <StaticStat value="AEO" label="Optimized" />
        </motion.dl>

        {/* trending row */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.75 }}
          className="mx-auto mt-10 flex max-w-2xl flex-wrap items-center justify-center gap-x-2 gap-y-2 text-[12.5px]"
        >
          <span className="inline-flex items-center gap-1.5 font-semibold text-[var(--cyan-strong)]">
            <TrendingUp className="size-3.5" strokeWidth={2.4} />
            Trending
          </span>
          {trending.slice(0, 5).map((t) => (
            <button
              key={t.slug}
              type="button"
              onClick={() => onOpenSearch(t.term)}
              className="text-[var(--ink-4)] transition-colors hover:text-foreground"
            >
              {t.term}
              <span className="mx-1 text-[var(--cyan-line)]">·</span>
            </button>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

function Stat({ value, suffix, label }: { value: number; suffix?: string; label: string }) {
  const counted = useCountUp(value, true, 0, 1200);
  return (
    <div className="flex flex-col items-center gap-1">
      <dd className="font-mono text-[1.9rem] font-semibold leading-none tracking-[-0.04em] tabular-nums text-foreground">
        {counted}
        {suffix}
      </dd>
      <dt className="text-[12px] font-medium uppercase tracking-[0.08em] text-[var(--ink-4)]">{label}</dt>
    </div>
  );
}

function StaticStat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <dd className="font-mono text-[1.9rem] font-semibold leading-none tracking-[-0.03em] text-foreground">{value}</dd>
      <dt className="text-[12px] font-medium uppercase tracking-[0.08em] text-[var(--ink-4)]">{label}</dt>
    </div>
  );
}
