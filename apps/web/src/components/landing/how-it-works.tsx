"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Globe } from "lucide-react";
import { Reveal, RevealItem, CARD } from "./surface";
import { Gauge, StatusDot, useInViewOnce } from "./viz";
import { Mark, SectionIntro } from "./section-intro";
import { LinkedinMark } from "./brand-glyphs";
import { cn } from "@/lib/utils";


/**
 * S1 · How it works (01/05) — "What do I actually have to do?"
 * Three visual-first StepCards (blueprint anatomy: product render → index → H3 →
 * body → one-line kicker). No button: S1–S6 carry no CTAs so the three real
 * conversion points (S7/S8/S10) keep their pull. The single site-wide time claim
 * lives in the H2 and is sourced honestly in the footer line.
 */

type Step = {
  n: string;
  frameLabel: string;
  title: string;
  body: string;
  kicker: string;
  mock: React.ReactNode;
};

const STEPS: Step[] = [
  {
    n: "01",
    frameLabel: "Your buyer profile",
    title: "Tell us your business",
    body: "Paste your website. Vantera drafts your buyer profile as editable chips.",
    kicker: "Edit anything. Confirm in a couple of minutes.",
    mock: <ConnectMock />,
  },
  {
    n: "02",
    frameLabel: "Prospecting · live",
    title: "Deploy your agents",
    body: "Agents find matching buyers, score them, and write each first message from real activity.",
    kicker: "Nothing sends. Everything queues for you.",
    mock: <ProspectMock />,
  },
  {
    n: "03",
    frameLabel: "Review queue",
    title: "Approve, then watch replies land",
    body: "Every draft waits for you. Approve, edit, or skip — replies come back sorted.",
    kicker: "Your account, your words, your call.",
    mock: <ConvertMock />,
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="relative bg-white py-10 sm:py-14">
      <div className="relative mx-auto max-w-6xl px-6 lg:px-8">
        {/* Header sits OUTSIDE the panel, left-aligned; the tinted shell below
            holds only the product (Dripify: heading above, panel is the figure) */}
        <SectionIntro
          index="01"
          label="How it works"
          title={
            <>
              <Mark>15 minutes</Mark> from your website to agents at work.
            </>
          }
          lead="Three steps. No demo call, no CSV imports."
        />

        <div className="mt-10 rounded-[28px] bg-[#EFF5FE] px-6 py-10 sm:px-10 sm:py-12 lg:px-14 lg:py-14">
        <Reveal className="grid gap-6 lg:grid-cols-3 lg:gap-7">
          {STEPS.map((s) => (
            <RevealItem key={s.n} className="h-full">
              <div className={cn(CARD, "flex h-full flex-col overflow-hidden")}>
                {/* screen well — the product render on its own quiet ground */}
                <div className="relative border-b border-[var(--hairline)] bg-[#f6f8fb] px-4 pb-4 pt-12">
                  <span className="absolute left-4 top-4 grid h-6 min-w-6 place-items-center rounded-[7px] bg-[var(--fb)] px-1 font-mono text-[11px] font-bold text-white shadow-[0_4px_12px_-4px_rgba(24,119,242,0.5)]">
                    {s.n}
                  </span>
                  <span className="absolute right-4 top-[19px] text-[9.5px] font-semibold uppercase tracking-[0.12em] text-[var(--ink-4)]">
                    {s.frameLabel}
                  </span>
                  <div className="rounded-xl border border-[var(--hairline)] bg-white p-3 shadow-[var(--shadow-sm)]">
                    {s.mock}
                  </div>
                </div>
                {/* copy */}
                <div className="flex flex-1 flex-col p-6">
                  <h3 className="text-[18px] font-semibold leading-snug tracking-[-0.015em] text-foreground">
                    {s.title}
                  </h3>
                  <p className="mt-2 text-[14px] leading-relaxed text-[var(--ink-3)]">{s.body}</p>
                  <p className="mt-auto flex items-start gap-2 pt-4 text-[13.5px] font-medium text-foreground">
                    <ArrowRight
                      className="mt-[3px] size-3.5 shrink-0 text-[var(--cyan-strong)]"
                      strokeWidth={2.4}
                      aria-hidden
                    />
                    {s.kicker}
                  </p>
                </div>
              </div>
            </RevealItem>
          ))}
        </Reveal>

        {/* The time claim, sourced — a measured product target, not a slogan. */}
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.6 }}
          className="mt-10 max-w-xl text-[13px] leading-relaxed text-[var(--ink-4)]"
        >
          A measured target, not a slogan — a deployed agent&rsquo;s first run starts within
          15 minutes.
        </motion.p>
        </div>
      </div>
    </section>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   Step mocks — real-density renders of the actual product surfaces, blue/white
   only (brand discipline: the one accent family). All decorative (aria-hidden).
──────────────────────────────────────────────────────────────────────────── */

/** 01 — website read + LinkedIn connection + learned ICP chips. */
function ConnectMock() {
  const reduce = useReducedMotion();
  const chips = ["B2B SaaS", "Series A–C", "RevOps leaders", "50–500 emp"];
  return (
    <div aria-hidden>
      {/* url field */}
      <div className="flex items-center gap-2 rounded-[9px] bg-[#F4F6F8] px-2.5 py-2">
        <Globe className="size-3.5 shrink-0 text-[var(--cyan-strong)]" />
        <span className="truncate text-[11.5px] font-medium text-[#3A444D]">acme.io</span>
        <span className="ml-auto flex items-center gap-1 rounded-full bg-[var(--cyan-tint)] px-1.5 py-0.5 text-[8.5px] font-bold uppercase tracking-[0.08em] text-[var(--cyan-strong)]">
          <span className="size-1 rounded-full bg-[var(--cyan)]" />
          Read
        </span>
      </div>

      {/* linkedin connection */}
      <div className="mt-2 flex items-center gap-2 rounded-[9px] border border-[#E6EAEE] px-2.5 py-2">
        <span className="grid size-6 place-items-center rounded-[6px] border border-[var(--hairline)] bg-white shadow-[var(--shadow-sm)]">
          <LinkedinMark className="size-3.5 text-[var(--fb)]" />
        </span>
        <span className="text-[11.5px] font-semibold text-[#0F172A]">LinkedIn</span>
        <span className="ml-auto flex items-center gap-1 rounded-full bg-[var(--cyan-tint)] px-1.5 py-0.5 text-[8.5px] font-bold uppercase tracking-[0.08em] text-[var(--cyan-strong)]">
          <span className="size-1 rounded-full bg-[var(--cyan)]" />
          Connected
        </span>
      </div>

      {/* learned chips */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {chips.map((c, i) => (
          <motion.span
            key={c}
            initial={reduce ? false : { opacity: 0, y: 6 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: reduce ? 0 : 0.15 + i * 0.08, ease: [0.22, 1, 0.36, 1] }}
            className="rounded-full border border-[var(--hairline)] bg-[#F8FAFC] px-2 py-[3px] text-[9.5px] font-medium text-[#475569]"
          >
            {c}
          </motion.span>
        ))}
      </div>
    </div>
  );
}

/** 02 — a scored prospect with a drafted message preview + the pacing gauge. */
function ProspectMock() {
  const [ref, inView] = useInViewOnce();
  return (
    <div ref={ref} aria-hidden>
      {/* scored prospect row */}
      <div className="flex items-center gap-2.5">
        <span className="grid size-8 flex-none place-items-center rounded-full bg-gradient-to-br from-[#e2e8f0] to-[#cbd5e1] text-[10px] font-bold text-[#475569]">
          DM
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11.5px] font-semibold leading-tight text-[#0F172A]">Dana Meyer</p>
          <p className="truncate text-[9.5px] leading-tight text-[#64748B]">VP Sales · Northwind</p>
        </div>
        <span className="flex-none rounded-full bg-[var(--cyan-tint)] px-2 py-[3px] text-[9.5px] font-bold tabular-nums text-[var(--cyan-strong)]">
          94 fit
        </span>
      </div>

      {/* drafted message preview — real personalized copy, softly clipped */}
      <div className="mt-2.5 rounded-[9px] bg-[#F4F6F8] px-2.5 py-2">
        <div className="mb-1 flex items-center gap-1.5">
          <StatusDot size="sm" />
          <span className="text-[8.5px] font-bold uppercase tracking-[0.1em] text-[var(--ink-4)]">Drafted</span>
        </div>
        <p className="text-[9px] leading-snug text-[#475569] [mask-image:linear-gradient(90deg,#000_74%,transparent)]">
          Hi Dana — your note on scaling RevOps without adding headcount lines up with what we just fixed for two teams in your space.
        </p>
      </div>

      {/* safe-paced sending — a real gauge with tick marks */}
      <div className="mt-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[8.5px] font-semibold uppercase tracking-[0.08em] text-[var(--ink-4)]">Safe pace</span>
          <span className="text-[9px] font-semibold tabular-nums text-[#475569]">31 / 50 today</span>
        </div>
        <Gauge className="mt-1.5" pct={62} ticks={[25, 50, 75]} run={inView} />
      </div>
    </div>
  );
}

/** 03 — the approve moment + an inbound reply + CRM handoff. */
function ConvertMock() {
  const reduce = useReducedMotion();
  return (
    <div aria-hidden>
      {/* approve row */}
      <div className="flex items-center gap-2 rounded-[9px] border border-[var(--hairline)] px-2.5 py-2">
        <span className="grid size-5 place-items-center rounded-[6px] bg-[var(--cyan-tint)] text-[var(--cyan-strong)]">
          <ArrowRight className="size-3 -rotate-45" strokeWidth={2.4} />
        </span>
        <span className="text-[11px] font-semibold text-[#0F172A]">Approved · 12 sends</span>
        <span className="ml-auto flex h-4 w-7 items-center rounded-full bg-[var(--fb)] p-[2px]">
          <motion.span
            initial={reduce ? false : { x: 0 }}
            whileInView={{ x: 12 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: reduce ? 0 : 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="size-3 rounded-full bg-white shadow-[0_1px_2px_rgba(16,24,32,.25)]"
          />
        </span>
      </div>

      {/* inbound reply */}
      <div className="mt-2 flex items-start gap-2 rounded-[9px] bg-[#F4F6F8] px-2.5 py-2">
        <span className="grid size-6 flex-none place-items-center rounded-full bg-gradient-to-br from-[#e2e8f0] to-[#cbd5e1] text-[8.5px] font-bold text-[#475569]">
          JR
        </span>
        <div className="min-w-0">
          <p className="text-[10px] font-semibold leading-tight text-[#0F172A]">Reply from Jordan</p>
          <p className="mt-0.5 text-[9.5px] leading-snug text-[#475569]">
            &ldquo;Happy to chat — does Thursday work?&rdquo;
          </p>
        </div>
      </div>

      {/* crm-synced badge */}
      <div className="mt-2 flex items-center justify-between rounded-[9px] px-2.5 py-1.5">
        <span className="text-[9.5px] font-medium text-[#64748B]">Qualified conversation</span>
        <span className="flex items-center gap-1 rounded-full bg-[var(--cyan-tint)] px-2 py-[3px] text-[8.5px] font-bold uppercase tracking-[0.08em] text-[var(--cyan-strong)]">
          <ArrowRight className="size-2.5" strokeWidth={2.6} />
          Synced to CRM
        </span>
      </div>
    </div>
  );
}
