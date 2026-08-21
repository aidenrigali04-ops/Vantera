"use client";

import { memo, useEffect, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Sparkles, TrendingUp, Users } from "lucide-react";
import { DeltaChip, Gauge, Sparkline, StatusDot, useCountUp } from "@/components/landing/viz";
import type { HeroContent, HeroVisual } from "./types";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

function rise(delay: number) {
  return {
    initial: { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.7, delay, ease: EASE },
  };
}

/**
 * Use-case hero — the homepage hero's split layout (content left, live product graphic
 * right) tailored per page. The reserved Facebook-blue chip carries the outcome word, a
 * dual CTA leads the eye, and the right column is a bespoke "Team Command Center"
 * dashboard (distinct from the homepage month-calendar): a narrowing pipeline funnel, a
 * rep leaderboard, a reply-rate gauge, a booked-meetings trend, and a live qualified-lead
 * toast. All instrument data is decorative (aria-hidden); the honest CTA copy is real DOM.
 */
export function UseCaseHero({ content }: { content: HeroContent }) {
  return (
    <section
      id="top"
      className="relative overflow-hidden pt-32 pb-8 sm:pt-36 lg:pt-40 lg:pb-14"
    >
      {/* single soft cyan/blue ambience, top-right — masked so it never reads as a glow blob */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(46% 40% at 80% 4%, rgba(24,119,242,0.15) 0%, transparent 62%), radial-gradient(38% 34% at 10% 0%, rgba(24,119,242,0.06) 0%, transparent 60%)",
        }}
      />

      <div className="mx-auto w-full max-w-6xl px-6 lg:px-8">
        <div className="grid items-center gap-14 lg:grid-cols-[1.02fr_1fr] lg:gap-12">
          {/* LEFT — content */}
          <div className="max-w-xl">
            <motion.span
              {...rise(0)}
              className="inline-flex items-center gap-2 rounded-full border border-[var(--hairline)] bg-white px-3 py-1.5 text-[12px] font-semibold uppercase tracking-[0.14em] text-[var(--cyan-strong)] shadow-[var(--shadow-sm)]"
            >
              <Users className="size-3.5" strokeWidth={2.2} />
              {content.eyebrow}
            </motion.span>

            <motion.h1
              {...rise(0.06)}
              className="mt-6 text-[2.7rem] font-semibold leading-[1.12] tracking-[-0.04em] text-foreground sm:text-[3.3rem] lg:text-[3.7rem]"
            >
              {content.headlinePre}{" "}
              <span className="relative inline-block rounded-[12px] px-3 pb-[0.12em] pt-[0.04em] text-white shadow-[0_12px_30px_-10px_rgba(24,119,242,0.6)] [background:linear-gradient(180deg,#2a82f7_0%,#1877f2_56%,#166fe5_100%)]">
                {content.headlineHighlight}
              </span>
              {content.headlinePost}
            </motion.h1>

            <motion.p
              {...rise(0.14)}
              className="mt-6 max-w-lg text-[17px] font-normal leading-relaxed text-[var(--ink-3)] sm:text-[18.5px]"
            >
              {content.sub}
            </motion.p>

            <motion.div {...rise(0.22)} className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href={content.primaryCta.href}
                className="group inline-flex items-center gap-2 rounded-full bg-[var(--fb-strong)] px-6 py-3 text-[15px] font-semibold text-white shadow-[0_6px_18px_-8px_rgba(24,119,242,0.5)] transition-all hover:bg-[#1461d1] hover:-translate-y-0.5 hover:shadow-[0_12px_28px_-12px_rgba(24,119,242,0.5)] active:scale-[0.98]"
              >
                {content.primaryCta.label}
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <a
                href={content.secondaryCta.href}
                className="inline-flex items-center gap-2 rounded-full border border-[var(--hairline)] bg-white px-6 py-3 text-[15px] font-semibold text-[var(--ink-2)] shadow-[var(--shadow-sm)] transition-all hover:-translate-y-0.5 hover:border-[var(--cyan-line)] hover:text-foreground"
              >
                {content.secondaryCta.label}
              </a>
            </motion.div>

            <motion.ul {...rise(0.3)} className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2">
              {content.trust.map((t) => (
                <li key={t} className="inline-flex items-center gap-1.5 text-[13px] text-[var(--ink-4)]">
                  <span className="size-1.5 rounded-full bg-[var(--cyan)]" />
                  {t}
                </li>
              ))}
            </motion.ul>
          </div>

          {/* RIGHT — the live command center */}
          <motion.div
            className="min-w-0"
            initial={{ opacity: 0, y: 22, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.9, delay: 0.2, ease: EASE }}
          >
            <CommandCenter visual={content.visual} />
          </motion.div>
        </div>
      </div>
    </section>
  );
}

/* ── The "Team Command Center" dashboard graphic ──────────────────────────────── */
const CommandCenter = memo(function CommandCenter({ visual }: { visual: HeroVisual }) {
  const reduce = useReducedMotion();
  const [showToast, setShowToast] = useState(false);
  const booked = visual.funnel[visual.funnel.length - 1]?.value ?? 0;
  const bookedCount = useCountUp(booked, true, 0, 1400);
  const maxFunnel = Math.max(...visual.funnel.map((f) => f.value));

  useEffect(() => {
    // Defer via timeout (0ms under reduced motion) so we never setState synchronously in the effect body.
    const t = setTimeout(() => setShowToast(true), reduce ? 0 : 1100);
    return () => clearTimeout(t);
  }, [reduce]);

  return (
    <div className="relative w-full lg:w-[calc(50vw_-_58px)] lg:max-w-[660px]" aria-hidden>
      {/* soft blue glow lifting the card */}
      <div
        className="pointer-events-none absolute -inset-x-8 -bottom-10 -top-6 -z-10 rounded-[2.25rem] blur-2xl"
        style={{ background: "radial-gradient(60% 75% at 55% 30%, rgba(24,119,242,0.16), transparent 70%)" }}
      />

      <div
        className="overflow-hidden rounded-[18px] border border-[#E6EAEE] bg-white"
        style={{
          boxShadow:
            "inset 0 1px 0 rgba(255,255,255,.6), 0 1px 2px rgba(16,24,32,.04), 0 18px 40px -18px rgba(16,24,32,.18)",
        }}
      >
        {/* ── Header ─────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 border-b border-[#EFF2F5] px-4 pb-3 pt-3.5">
          <span className="grid size-7 place-items-center rounded-[8px] bg-[var(--cyan-tint)] text-[var(--cyan-strong)] ring-1 ring-inset ring-[var(--cyan-line)]">
            <Users className="size-[16px]" strokeWidth={2} />
          </span>
          <div className="leading-tight">
            <div className="text-[13.5px] font-semibold tracking-[-0.01em] text-[#0C1620]">{visual.title}</div>
            <div className="text-[10.5px] text-[#9AA5AD]">{visual.period}</div>
          </div>
          <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-[rgba(24,119,242,0.1)] px-2.5 py-[5px] text-[11px] font-semibold tabular-nums text-[#1461d1]">
            <StatusDot size="md" pulse />
            {bookedCount} booked
          </span>
        </div>

        {/* ── Pipeline funnel ────────────────────────────────────── */}
        <div className="px-4 pt-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#9AA5AD]">Pipeline</span>
            <span className="text-[10px] font-medium text-[#9AA5AD]">{visual.funnelCaption ?? "Sourced → Booked"}</span>
          </div>
          <div className="flex flex-col gap-1.5">
            {visual.funnel.map((stage, i) => {
              const pct = Math.max(8, Math.round((stage.value / maxFunnel) * 100));
              const isLast = i === visual.funnel.length - 1;
              return (
                <motion.div
                  key={stage.label}
                  className="flex items-center gap-2.5"
                  initial={reduce ? false : { opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5, delay: reduce ? 0 : 0.2 + i * 0.08, ease: EASE }}
                >
                  <span className="w-[62px] shrink-0 text-[10.5px] font-medium text-[#64748B]">{stage.label}</span>
                  <div className="relative h-[18px] flex-1 overflow-hidden rounded-[5px] bg-[#F4F6F8]">
                    <motion.div
                      className="absolute inset-y-0 left-0 rounded-[5px] shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]"
                      style={{
                        background: isLast
                          ? "linear-gradient(90deg,#2a82f7,var(--fb))"
                          : "linear-gradient(90deg,rgba(24,119,242,0.55),rgba(24,119,242,0.82))",
                      }}
                      initial={{ width: reduce ? `${pct}%` : 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.7, delay: reduce ? 0 : 0.28 + i * 0.08, ease: EASE }}
                    />
                  </div>
                  <span className="w-[42px] shrink-0 text-right text-[11px] font-semibold tabular-nums text-[#0F172A]">
                    {stage.value.toLocaleString()}
                  </span>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* ── Rep leaderboard ────────────────────────────────────── */}
        <div className="mt-4 border-t border-[#EFF2F5] px-4 pt-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#9AA5AD]">
              {visual.leaderboardTitle ?? "Reps · booked"}
            </span>
            <span className="text-[10px] font-medium text-[#9AA5AD]">
              {visual.leaderboardTrendLabel ?? "6-week trend"}
            </span>
          </div>
          <div className="flex flex-col gap-1.5">
            {visual.reps.slice(0, 3).map((rep, i) => (
              <motion.div
                key={rep.name}
                className="flex items-center gap-2.5 rounded-[9px] px-2 py-1.5 ring-1 ring-inset ring-[rgba(15,23,42,0.04)]"
                style={{ background: `${rep.tint}0d`, boxShadow: `inset 3px 0 0 ${rep.tint}` }}
                initial={reduce ? false : { opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: reduce ? 0 : 0.5 + i * 0.08, ease: EASE }}
              >
                <span
                  className="grid size-6 flex-none place-items-center rounded-[6px] text-[9.5px] font-bold leading-none text-white shadow-[0_1px_2px_rgba(16,24,32,0.16)]"
                  style={{ background: rep.tint }}
                >
                  {rep.initials}
                </span>
                <span className="min-w-0 flex-1 leading-none">
                  <span className="block truncate text-[11.5px] font-semibold tracking-[-0.01em] text-[#0F172A]">
                    {rep.name}
                  </span>
                  <span className="mt-[3px] block text-[9.5px] text-[#64748B]">{rep.role}</span>
                </span>
                <Sparkline points={rep.trend} width={52} height={16} draw={!reduce} />
                <span className="w-[26px] text-right text-[12px] font-semibold tabular-nums text-[#0F172A]">
                  {rep.booked}
                </span>
                <DeltaChip value={rep.delta} dir="up" className="hidden sm:inline-flex" />
              </motion.div>
            ))}
          </div>
        </div>

        {/* ── Footer — reply rate + booked trend ─────────────────── */}
        <div className="mt-3 flex items-stretch gap-4 border-t border-[#EFF2F5] px-4 pb-3.5 pt-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between">
              <span className="text-[9.5px] font-semibold uppercase tracking-[0.09em] text-[#9AA5AD]">
                {visual.replyRateLabel}
              </span>
              <span className="text-[10.5px] font-semibold tabular-nums text-[#1461d1]">{visual.replyRate}%</span>
            </div>
            <Gauge className="mt-2" pct={visual.replyRate} ticks={[25, 50, 75]} threshold={{ pct: 25 }} />
          </div>
          <div className="w-px bg-[#EFF2F5]" />
          <div className="flex flex-none flex-col items-end justify-between">
            <span className="text-[9.5px] font-semibold uppercase tracking-[0.09em] text-[#9AA5AD]">Booked · 6wk</span>
            <div className="mt-1 flex items-center gap-2">
              <Sparkline points={visual.bookedTrend} width={84} height={26} halo draw={!reduce} />
              <span className="inline-flex items-center gap-1 rounded-full bg-[rgba(24,119,242,0.1)] px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-[#1461d1]">
                <TrendingUp className="size-2.5" strokeWidth={2.6} />
                {visual.bookedDelta}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Live "new qualified lead" toast ────────────────────────── */}
      <motion.div
        className="absolute -bottom-5 -right-3 w-[248px] rounded-[13px] border border-[#E6EAEE] bg-white p-3 sm:-right-6"
        style={{
          boxShadow:
            "inset 0 1px 0 rgba(255,255,255,.7), 0 1px 2px rgba(16,24,32,.05), 0 16px 34px -14px rgba(16,24,32,.24)",
        }}
        initial={reduce ? { opacity: 0 } : { opacity: 0, y: 18, scale: 0.96 }}
        animate={showToast ? { opacity: 1, y: 0, scale: 1 } : {}}
        transition={{ duration: 0.6, ease: EASE }}
      >
        <div className="flex items-center gap-2">
          <span className="grid size-6 place-items-center rounded-full bg-[var(--fb-tint)] text-[var(--fb)] ring-1 ring-inset ring-[var(--cyan-line)]">
            <Sparkles className="size-3.5" strokeWidth={2} />
          </span>
          <span className="text-[10px] font-bold uppercase tracking-[0.09em] text-[var(--cyan-strong)]">
            {visual.toastLabel ?? "New qualified lead"}
          </span>
          <span className="ml-auto rounded-full bg-[var(--cyan-tint)] px-1.5 py-0.5 text-[9.5px] font-bold tabular-nums text-[var(--cyan-strong)]">
            {visual.toast.fit} fit
          </span>
        </div>
        <div className="mt-2 text-[12px] font-semibold tracking-[-0.01em] text-[#0F172A]">{visual.toast.name}</div>
        <div className="text-[10px] text-[#64748B]">{visual.toast.role}</div>
        <div className="mt-2 rounded-[7px] bg-[#F4F6F8] px-2 py-1.5 text-[9.5px] leading-snug text-[#475569]">
          {visual.toast.signal}
        </div>
      </motion.div>
    </div>
  );
});
