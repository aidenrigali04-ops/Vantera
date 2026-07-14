"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Globe, Radar, CheckCheck } from "lucide-react";
import { LandingHeading } from "./heading";
import { Reveal, RevealItem, CARD_INTERACTIVE } from "./surface";
import { Gauge, StatusDot, useInViewOnce } from "./viz";
import { cn } from "@/lib/utils";
import { trackEvent } from "@/lib/analytics/clarity";

/** LinkedIn brand glyph — lucide dropped brand icons, so we render it inline. */
function LinkedinMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.03-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.94v5.67H9.34V9h3.42v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.45v6.29zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.72v20.56C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.72V1.72C24 .77 23.2 0 22.22 0z" />
    </svg>
  );
}

/* ── Per-step content ──────────────────────────────────────────────────────── */
type Step = {
  n: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  headline: string;
  body: string;
  mock: React.ReactNode;
};

const STEPS: Step[] = [
  {
    n: "01",
    icon: Globe,
    title: "Connect",
    headline: "Enter your website, connect LinkedIn.",
    body: "Vantera reads your site, learns what you sell and who you target. No manual setup.",
    mock: <ConnectMock />,
  },
  {
    n: "02",
    icon: Radar,
    title: "Prospect",
    headline: "Your agents find and message your buyers.",
    body: "Sources in-market prospects, scores them, drafts personalized messages — safe-paced, multi-sender.",
    mock: <ProspectMock />,
  },
  {
    n: "03",
    icon: CheckCheck,
    title: "Convert",
    headline: "Approve, then watch replies land.",
    body: "You approve outbound, replies come in fully visible, qualified conversations sync to your CRM.",
    mock: <ConvertMock />,
  },
];

export function HowItWorks() {
  const router = useRouter();
  const [url, setUrl] = useState("");

  return (
    <section id="how-it-works" className="relative border-t border-[var(--hairline)] bg-[var(--tint)] py-24 sm:py-28">
      <div className="relative mx-auto max-w-6xl px-6 lg:px-8">
        <LandingHeading
          eyebrow="Getting started"
          title="Live in minutes. First replies this week."
          subtitle="Connect once. Three agents run the whole motion — sourcing, qualifying, and drafting — while you stay in control of every send."
        />

        {/* ── The flow: three numbered steps, joined by a subtle line ────────── */}
        <Reveal className="relative mt-16">
          {/* horizontal connector line across the row (lg only), sitting behind the cards.
              Aligned to the icon-well center: p-6 (24px) + half of size-11 (22px) = 46px. */}
          <div
            aria-hidden
            className="pointer-events-none absolute left-0 right-0 top-[46px] hidden lg:block"
          >
            <div className="mx-auto h-px w-[calc(100%-8rem)] bg-gradient-to-r from-transparent via-[var(--cyan-line)] to-transparent" />
          </div>

          <div className="grid gap-6 sm:gap-9 lg:grid-cols-3 lg:gap-7">
            {STEPS.map((s, i) => (
              <RevealItem key={s.title} className="relative flex flex-col">
                {/* vertical connector node between stacked cards (mobile/tablet) */}
                {i < STEPS.length - 1 && (
                  <span
                    aria-hidden
                    className="absolute -bottom-[28px] left-1/2 z-10 hidden size-7 -translate-x-1/2 place-items-center rounded-full border border-[var(--cyan-line)] bg-white text-[var(--cyan-strong)] shadow-[var(--shadow-sm)] sm:grid lg:hidden"
                  >
                    <ArrowRight className="size-3.5 rotate-90" strokeWidth={2.4} />
                  </span>
                )}

                <div
                  className={cn(
                    CARD_INTERACTIVE,
                    "group relative flex h-full flex-col overflow-hidden p-6",
                  )}
                >
                  {/* header row: number + icon well (hero-calendar icon-well recipe) */}
                  <div className="flex items-center justify-between">
                    <span className="grid size-11 place-items-center rounded-xl bg-[var(--cyan-tint)] text-[var(--cyan-strong)] shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] ring-1 ring-inset ring-[var(--cyan-line)] transition-transform duration-300 group-hover:scale-105">
                      <s.icon className="size-5" />
                    </span>
                    <span className="font-mono text-[13px] font-semibold tabular-nums tracking-[0.14em] text-[var(--ink-4)] transition-colors duration-300 group-hover:text-[var(--cyan-strong)]">
                      {s.n}
                    </span>
                  </div>

                  <h3 className="mt-5 text-[13px] font-bold uppercase tracking-[0.14em] text-[var(--cyan-strong)]">
                    {s.title}
                  </h3>
                  <p className="mt-2 text-[18px] font-semibold leading-snug tracking-[-0.015em] text-foreground">
                    {s.headline}
                  </p>
                  <p className="mt-2.5 text-[14.5px] leading-relaxed text-[var(--ink-3)]">{s.body}</p>

                  {/* per-step mockup — pinned to the card foot so all three align across the row */}
                  <div className="mt-auto pt-6">{s.mock}</div>
                </div>
              </RevealItem>
            ))}
          </div>
        </Reveal>

        {/* ── CTA — primary --fb button + light URL pill + microcopy ─────────── */}
        <motion.div
          initial={{ opacity: 0, y: 22 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="mx-auto mt-16 flex max-w-md flex-col items-center text-center"
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const site = url.trim();
              trackEvent("cta_click", { location: "how_it_works", has_site: site ? "1" : "0" });
              router.push(site ? `/signup?site=${encodeURIComponent(site)}` : "/signup");
            }}
            className="flex w-full items-center gap-2 rounded-[12px] border border-[var(--hairline)] bg-white py-1.5 pl-5 pr-1.5 shadow-[var(--shadow-card)] transition-shadow focus-within:border-[var(--fb)] focus-within:shadow-[0_0_0_3px_rgba(24,119,242,0.16),var(--shadow-card)]"
          >
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Enter your website URL"
              aria-label="Your website URL"
              className="min-w-0 flex-1 bg-transparent text-[15px] text-foreground outline-none placeholder:text-[var(--ink-4)]"
            />
            <button
              type="submit"
              className="group/btn inline-flex shrink-0 items-center gap-1.5 rounded-[10px] bg-[var(--fb-strong)] px-5 py-2.5 text-[14px] font-semibold text-white transition-all hover:bg-[#1461d1] hover:shadow-[0_8px_20px_-8px_rgba(24,119,242,0.4)] active:scale-[0.98]"
            >
              Start free
              <ArrowRight className="size-4 transition-transform duration-300 group-hover/btn:translate-x-0.5 motion-reduce:transition-none motion-reduce:group-hover/btn:translate-x-0" />
            </button>
          </form>
          <p className="mt-4 text-[13px] text-[var(--ink-4)]">
            No credit card required · Free 5-day trial
          </p>
        </motion.div>
      </div>
    </section>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   Step mockups — small, matching the hero-calendar's light-card polish.
   All decorative (aria-hidden), reduced-motion aware.
──────────────────────────────────────────────────────────────────────────── */

// Nested mockup card — the hero-calendar light-card recipe (inner top highlight +
// layered soft shadow), scaled down for these small in-card mockups.
const CARD_INNER =
  "rounded-[12px] border border-[#E6EAEE] bg-white shadow-[inset_0_1px_0_rgba(255,255,255,0.6),0_1px_2px_rgba(16,24,32,0.04),0_6px_16px_-10px_rgba(16,24,32,0.1)]";

/** 01 — a website URL bar reading into a LinkedIn connection, "learned" chips below. */
function ConnectMock() {
  const reduce = useReducedMotion();
  const chips = ["B2B SaaS", "Series A–C", "RevOps leaders", "50–500 emp"];
  return (
    <div className={cn(CARD_INNER, "p-3")} aria-hidden>
      {/* url field */}
      <div className="flex items-center gap-2 rounded-[9px] bg-[#F4F6F8] px-2.5 py-2">
        <Globe className="size-3.5 shrink-0 text-[var(--cyan-strong)]" />
        <span className="truncate text-[11.5px] font-medium text-[#3A444D]">acme.io</span>
        <span className="ml-auto flex items-center gap-1 rounded-full bg-[#eafaf0] px-1.5 py-0.5 text-[8.5px] font-bold uppercase tracking-[0.08em] text-[#1a9e4b]">
          <span className="size-1 rounded-full bg-[#1a9e4b]" />
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

/** 02 — a scored prospect card with a drafted message preview + pacing bar. */
function ProspectMock() {
  const [ref, inView] = useInViewOnce();
  return (
    <div ref={ref} className={cn(CARD_INNER, "p-3")} aria-hidden>
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

/** 03 — an approve toggle over an inbound reply, with a CRM-synced badge. */
function ConvertMock() {
  const reduce = useReducedMotion();
  return (
    <div className={cn(CARD_INNER, "p-3")} aria-hidden>
      {/* approve row */}
      <div className="flex items-center gap-2 rounded-[9px] border border-[var(--hairline)] px-2.5 py-2">
        <span className="grid size-5 place-items-center rounded-[6px] bg-[#eafaf0] text-[#1a9e4b]">
          <CheckCheck className="size-3" strokeWidth={2.4} />
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
