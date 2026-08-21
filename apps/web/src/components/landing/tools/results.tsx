"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Copy, Check, TrendingUp, ThumbsUp, Wrench, Flame, Terminal, Lightbulb } from "lucide-react";
import type { ToolOutput } from "@/lib/tools/registry";
import type {
  VariantsResult,
  BooleanResult,
  ScoreResult,
  RoastResult,
} from "@/lib/tools/schemas";
import { cn } from "@/lib/utils";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.04 } },
};
const item = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } },
};

/** Eased 0 → target count-up for the score number. */
function useCountUp(target: number, duration = 900): number {
  const reduce = useReducedMotion();
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (reduce) return; // reduced motion returns `target` directly below — no state churn
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(target * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, reduce]);
  return reduce ? target : val;
}

/* ── Copy-to-clipboard button ─────────────────────────────────────────────── */
function CopyButton({ text, className }: { text: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard?.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1600);
        });
      }}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] font-medium transition-all active:scale-95",
        copied
          ? "border-[#bfe6cd] bg-[#eafaf0] text-[#12a150]"
          : "border-[var(--hairline)] bg-white text-[var(--ink-2)] hover:border-[var(--cyan-line)] hover:text-[var(--cyan-strong)]",
        className,
      )}
    >
      {copied ? (
        <>
          <Check className="size-3.5" strokeWidth={2.6} /> Copied
        </>
      ) : (
        <>
          <Copy className="size-3.5" /> Copy
        </>
      )}
    </button>
  );
}

/* ── Variants (headlines, messages, hooks, …) ─────────────────────────────── */
function Variants({ data }: { data: VariantsResult }) {
  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-4">
      {data.variants.map((v, i) => (
        <motion.div
          key={i}
          variants={item}
          className="group relative rounded-2xl border border-[var(--hairline)] bg-white p-5 shadow-[var(--shadow-card)] transition-all duration-300 hover:border-[var(--cyan-line)] hover:shadow-[var(--shadow-lift)] sm:p-6"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="grid size-6 place-items-center rounded-md bg-[var(--tint)] font-mono text-[11px] font-semibold tabular-nums text-[var(--ink-4)]">
                {i + 1}
              </span>
              <span className="inline-flex items-center rounded-full bg-[var(--cyan-tint)] px-2.5 py-0.5 text-[11.5px] font-semibold text-[var(--cyan-strong)]">
                {v.label}
              </span>
            </div>
            <CopyButton text={v.text} className="opacity-70 transition-opacity group-hover:opacity-100" />
          </div>

          <p className="mt-3.5 whitespace-pre-wrap text-[15px] leading-relaxed text-foreground">{v.text}</p>

          <div className="mt-4 flex items-center justify-between gap-3 border-t border-[var(--hairline)] pt-3.5">
            <p className="flex items-start gap-1.5 text-[13px] leading-relaxed text-[var(--ink-4)]">
              <Lightbulb className="mt-0.5 size-3.5 shrink-0 text-[var(--cyan-strong)]" />
              {v.tip}
            </p>
            <span className="shrink-0 rounded-full bg-[var(--tint)] px-2 py-0.5 font-mono text-[10.5px] tabular-nums text-[var(--ink-4)]">
              {v.text.length}
            </span>
          </div>
        </motion.div>
      ))}
    </motion.div>
  );
}

/* ── Boolean search string (dark IDE console) ─────────────────────────────── */
function Boolean_({ data }: { data: BooleanResult }) {
  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-4">
      <motion.div
        variants={item}
        className="overflow-hidden rounded-2xl border border-[var(--panel-line)] bg-[var(--panel)] shadow-[var(--shadow-lift)]"
      >
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5">
          <span className="inline-flex items-center gap-1.5 font-mono text-[11.5px] font-medium text-white/60">
            <Terminal className="size-3.5 text-[var(--cyan)]" /> boolean query
          </span>
          <button
            type="button"
            onClick={() => void navigator.clipboard?.writeText(data.query)}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[12px] font-medium text-white/80 transition-colors hover:border-white/30 hover:text-white"
          >
            <Copy className="size-3.5" /> Copy
          </button>
        </div>
        <pre className="overflow-x-auto px-4 py-4 font-mono text-[13px] leading-relaxed text-[#d5e6ff]">
          <code className="whitespace-pre-wrap break-words">{data.query}</code>
        </pre>
      </motion.div>

      <motion.p variants={item} className="text-[14.5px] leading-relaxed text-[var(--ink-3)]">
        {data.explanation}
      </motion.p>

      {data.tips.length > 0 && (
        <motion.div
          variants={item}
          className="rounded-2xl border border-[var(--hairline)] bg-white p-5 shadow-[var(--shadow-sm)]"
        >
          <h4 className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[var(--ink-4)]">Refine it</h4>
          <ul className="mt-3 space-y-2.5">
            {data.tips.map((t, i) => (
              <li key={i} className="flex gap-3 text-[14px] leading-relaxed text-[var(--ink-3)]">
                <span className="grid size-5 shrink-0 place-items-center rounded-md bg-[var(--cyan-tint)] font-mono text-[10px] font-bold text-[var(--cyan-strong)]">
                  {i + 1}
                </span>
                {t}
              </li>
            ))}
          </ul>
        </motion.div>
      )}
    </motion.div>
  );
}

function scoreColor(score: number): string {
  if (score >= 75) return "#12a150";
  if (score >= 50) return "#1877f2";
  return "#e5734d";
}

/* ── Score (SSI, profile analysis) ────────────────────────────────────────── */
function Score({ data }: { data: ScoreResult }) {
  const reduce = useReducedMotion();
  const shown = useCountUp(data.score);
  const color = scoreColor(data.score);
  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-4">
      {/* headline score */}
      <motion.div
        variants={item}
        className="flex items-center gap-5 rounded-2xl border border-[var(--hairline)] bg-white p-6 shadow-[var(--shadow-card)] sm:gap-6"
      >
        <div
          className="grid size-[88px] shrink-0 place-items-center rounded-full"
          style={{ background: `conic-gradient(${color} ${shown * 3.6}deg, #eef2f7 0deg)` }}
        >
          <span className="grid size-[70px] place-items-center rounded-full bg-white">
            <span className="text-[1.7rem] font-semibold tabular-nums text-foreground">{shown}</span>
          </span>
        </div>
        <div>
          <span
            className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[12px] font-semibold"
            style={{ background: `${color}18`, color }}
          >
            {data.grade}
          </span>
          <p className="mt-2 text-[14.5px] leading-relaxed text-[var(--ink-3)]">{data.summary}</p>
        </div>
      </motion.div>

      {/* per-section breakdown bars */}
      <motion.div
        variants={item}
        className="space-y-4 rounded-2xl border border-[var(--hairline)] bg-white p-6 shadow-[var(--shadow-sm)]"
      >
        {data.breakdown.map((b, i) => (
          <div key={i}>
            <div className="flex items-baseline justify-between">
              <span className="text-[14px] font-medium text-foreground">{b.label}</span>
              <span className="font-mono text-[12px] tabular-nums text-[var(--ink-4)]">{b.score}/100</span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#eef2f7]">
              <motion.div
                className="h-full rounded-full"
                style={{ background: scoreColor(b.score) }}
                initial={reduce ? false : { width: 0 }}
                animate={{ width: `${b.score}%` }}
                transition={{ duration: 0.8, ease: EASE, delay: 0.15 + i * 0.08 }}
              />
            </div>
            <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--ink-4)]">{b.note}</p>
          </div>
        ))}
      </motion.div>

      <motion.div variants={item} className="grid gap-4 sm:grid-cols-2">
        {data.wins.length > 0 && (
          <div className="rounded-2xl border border-[var(--hairline)] bg-white p-5 shadow-[var(--shadow-sm)]">
            <h4 className="flex items-center gap-2 text-[13px] font-semibold text-foreground">
              <ThumbsUp className="size-4 text-[#12a150]" /> What&rsquo;s working
            </h4>
            <ul className="mt-3 space-y-2">
              {data.wins.map((w, i) => (
                <li key={i} className="flex gap-2.5 text-[13.5px] leading-relaxed text-[var(--ink-3)]">
                  <Check className="mt-0.5 size-3.5 shrink-0 text-[#12a150]" strokeWidth={2.6} />
                  {w}
                </li>
              ))}
            </ul>
          </div>
        )}
        {data.fixes.length > 0 && (
          <div className="rounded-2xl border border-[var(--hairline)] bg-white p-5 shadow-[var(--shadow-sm)]">
            <h4 className="flex items-center gap-2 text-[13px] font-semibold text-foreground">
              <Wrench className="size-4 text-[var(--cyan-strong)]" /> Fix these first
            </h4>
            <ul className="mt-3 space-y-2">
              {data.fixes.map((f, i) => (
                <li key={i} className="flex gap-2.5 text-[13.5px] leading-relaxed text-[var(--ink-3)]">
                  <TrendingUp className="mt-0.5 size-3.5 shrink-0 text-[var(--cyan-strong)]" />
                  {f}
                </li>
              ))}
            </ul>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

/* ── Roast ────────────────────────────────────────────────────────────────── */
function roastVerdict(score: number): string {
  if (score >= 75) return "Yikes — buzzword supernova";
  if (score >= 50) return "Solidly cringe, some hope";
  if (score >= 25) return "Mild cringe, mostly fine";
  return "Honestly? Pretty clean";
}

function Roast({ data }: { data: RoastResult }) {
  const reduce = useReducedMotion();
  const shown = useCountUp(data.cringeScore);
  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-4">
      <motion.div
        variants={item}
        className="flex items-center gap-4 rounded-2xl border border-[var(--hairline)] bg-white p-5 shadow-[var(--shadow-card)]"
      >
        <Flame className="size-7 shrink-0 text-[#e5734d]" />
        <div className="flex-1">
          <div className="flex items-baseline justify-between">
            <span className="text-[13px] font-semibold text-foreground">
              Cringe meter <span className="font-normal text-[var(--ink-4)]">· {roastVerdict(data.cringeScore)}</span>
            </span>
            <span className="font-mono text-[13px] font-semibold tabular-nums text-[#e5734d]">{shown}/100</span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[#eef2f7]">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-[#f0b429] to-[#e5484d]"
              initial={reduce ? false : { width: 0 }}
              animate={{ width: `${data.cringeScore}%` }}
              transition={{ duration: 0.9, ease: EASE, delay: 0.15 }}
            />
          </div>
        </div>
      </motion.div>

      <div className="space-y-3">
        {data.roast.map((line, i) => (
          <motion.div
            key={i}
            variants={item}
            className="relative rounded-2xl border border-[var(--hairline)] bg-white p-4 pl-5 shadow-[var(--shadow-sm)]"
          >
            <span className="absolute left-0 top-3 bottom-3 w-[3px] rounded-full bg-gradient-to-b from-[#f0b429] to-[#e5484d]" />
            <p className="text-[15px] leading-relaxed text-foreground">{line}</p>
          </motion.div>
        ))}
      </div>

      <motion.div variants={item} className="rounded-2xl border border-[var(--cyan-line)] bg-[var(--cyan-tint)] p-5">
        <h4 className="flex items-center gap-2 text-[13px] font-semibold text-foreground">
          <Wrench className="size-4 text-[var(--cyan-strong)]" /> Okay, but seriously — fix these
        </h4>
        <ul className="mt-3 space-y-2">
          {data.realTalk.map((t, i) => (
            <li key={i} className="flex gap-2.5 text-[14px] leading-relaxed text-[var(--ink-2)]">
              <Check className="mt-0.5 size-3.5 shrink-0 text-[var(--cyan-strong)]" strokeWidth={2.6} />
              {t}
            </li>
          ))}
        </ul>
      </motion.div>
    </motion.div>
  );
}

/* ── Dispatcher ───────────────────────────────────────────────────────────── */
export function ToolResults({ output, result }: { output: ToolOutput; result: unknown }) {
  switch (output) {
    case "variants":
      return <Variants data={result as VariantsResult} />;
    case "boolean":
      return <Boolean_ data={result as BooleanResult} />;
    case "score":
      return <Score data={result as ScoreResult} />;
    case "roast":
      return <Roast data={result as RoastResult} />;
    default:
      return null;
  }
}
