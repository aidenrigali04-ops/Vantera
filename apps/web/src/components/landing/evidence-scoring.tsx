"use client";

import { MailCheck, Radar, User } from "lucide-react";
import { Reveal, RevealItem } from "./surface";
import { ProductFrame } from "./product-frame";
import { FrameGlow, Mark, SectionIntro } from "./section-intro";

/**
 * S4 · Evidence & scoring (04/05) — "How do you know these are the right people?"
 * Text left, product right: a prospect row with its score decomposition rendered OPEN
 * and static (marketing never hides the math behind a click). The two-stage model is
 * the real one (rule 06): a deterministic rules gate on ICP fit, then an AI rank on
 * signals — and the 70 threshold plus the never-rule line are the product's actual
 * gates, suppression included (rule 11).
 */

const DECOMPOSITION: { label: string; pts: string }[] = [
  { label: "Title match", pts: "+24" },
  { label: "Seniority", pts: "+12" },
  { label: "Headcount 11–50", pts: "+10" },
  { label: "Posted about pipeline pain · 3d", pts: "+30" },
  { label: "Active this week", pts: "+15" },
];

const EVIDENCE_CHIPS = [
  "Post · “…repeatable pipeline without an SDR” · 3d",
  "Hiring · Growth lead · 9d",
];

/** Compact score ring — r=15.5, C≈97.4; dasharray is score% of C. Static. */
function ScoreRing({ score }: { score: number }) {
  const C = 2 * Math.PI * 15.5;
  return (
    <span className="relative grid size-11 shrink-0 place-items-center">
      <svg viewBox="0 0 36 36" className="absolute inset-0 -rotate-90">
        <circle cx="18" cy="18" r="15.5" fill="none" stroke="rgba(24,119,242,0.14)" strokeWidth="2.6" />
        <circle
          cx="18" cy="18" r="15.5" fill="none" stroke="var(--fb)" strokeWidth="2.6"
          strokeLinecap="round" strokeDasharray={`${(score / 100) * C} ${C}`}
        />
      </svg>
      <span className="font-mono text-[12.5px] font-bold tabular-nums text-[var(--cyan-strong)]">{score}</span>
    </span>
  );
}

function ScoringEmbed() {
  return (
    <div aria-hidden>
      {/* identity strip */}
      <div className="flex items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#e2e8f0] to-[#cbd5e1] text-[12px] font-bold text-[#475569]">
          MC
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13.5px] font-semibold text-foreground">Maya Chen</p>
          <p className="truncate text-[11.5px] text-[var(--ink-4)]">
            Head of Growth · Northwind · 11–50
          </p>
        </div>
        <ScoreRing score={91} />
      </div>

      {/* the decomposition — open and static */}
      <div className="mt-4 rounded-xl border border-[var(--hairline)] bg-[#fbfcfe] p-3.5">
        <span className="block text-[9.5px] font-semibold uppercase tracking-[0.12em] text-[var(--ink-4)]">
          Why 91
        </span>
        <div className="mt-2.5 flex flex-col gap-1.5">
          {DECOMPOSITION.map((r) => (
            <div key={r.label} className="flex items-baseline justify-between gap-3">
              <span className="truncate text-[12px] text-[var(--ink-3)]">{r.label}</span>
              <span className="shrink-0 font-mono text-[11.5px] font-semibold tabular-nums text-[var(--ink-2)]">
                {r.pts}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-2.5 flex items-baseline justify-between gap-3 border-t border-[var(--hairline)] pt-2.5">
          <span className="text-[12px] font-semibold text-foreground">Total</span>
          <span className="font-mono text-[12px] font-bold tabular-nums text-[var(--cyan-strong)]">
            91
          </span>
        </div>
      </div>

      {/* evidence chips */}
      <div className="mt-3.5 flex flex-wrap gap-1.5">
        {EVIDENCE_CHIPS.map((c) => (
          <span
            key={c}
            className="inline-flex items-center gap-1.5 rounded-full border border-[var(--hairline)] bg-white px-2.5 py-1 text-[10.5px] font-medium text-[var(--ink-3)]"
          >
            <span className="size-1 rounded-full bg-[var(--cyan)]" />
            {c}
          </span>
        ))}
      </div>
    </div>
  );
}

export function EvidenceScoring() {
  return (
    <section id="evidence" className="relative bg-white py-10 sm:py-14">
      <div className="mx-auto max-w-6xl px-6 lg:px-8">
        <SectionIntro
          index="04"
          label="Evidence"
          title={
            <>
              Every prospect comes with <Mark>receipts</Mark>.
            </>
          }
          lead="A score isn't a vibe — the math is open on every number."
        />

        <div className="mt-10 rounded-[28px] bg-[#EFF5FE] px-6 py-10 sm:px-10 sm:py-12 lg:px-14 lg:py-14">
        <div className="grid items-center gap-14 lg:grid-cols-[1fr_1.1fr] lg:gap-16">
          {/* LEFT — the argument */}
          <div>
            <Reveal className="flex flex-col gap-5">
              {[
                {
                  icon: User,
                  head: "Fit",
                  text: "A deterministic gate on title, industry, headcount, geography.",
                },
                {
                  icon: Radar,
                  head: "Intent",
                  text: "What they posted, who they're hiring, what just changed.",
                },
                {
                  icon: MailCheck,
                  head: "Rationale",
                  text: "Every score ships with the agent's written reasoning.",
                },
              ].map((b) => (
                <RevealItem key={b.head} className="flex items-start gap-3.5">
                  <span className="grid size-9 shrink-0 place-items-center rounded-[10px] border border-[var(--hairline)] bg-white text-[var(--cyan-strong)] shadow-[0_2px_0_var(--hairline),var(--shadow-sm)]">
                    <b.icon className="size-4" strokeWidth={2.2} />
                  </span>
                  <p className="text-[15px] leading-relaxed text-[var(--ink-3)]">
                    <span className="font-semibold text-foreground">{b.head}.</span> {b.text}
                  </p>
                </RevealItem>
              ))}
            </Reveal>

            <p className="mt-8 inline-flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-[var(--hairline)] pt-6 font-mono text-[11.5px] uppercase tracking-[0.08em] text-[var(--ink-4)]">
              <span className="text-[var(--cyan-strong)]">70+</span> enters outreach
              <span aria-hidden>·</span> suppressed contacts are never messaged
            </p>
          </div>

          {/* RIGHT — the open decomposition */}
          <Reveal>
            <RevealItem className="relative">
              <FrameGlow />
              <ProductFrame label="Prospect · scored">
                <ScoringEmbed />
              </ProductFrame>
            </RevealItem>
          </Reveal>
        </div>
        </div>
      </div>
    </section>
  );
}
