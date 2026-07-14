import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check, Minus } from "lucide-react";
import { MarketingShell } from "@/components/landing/marketing-shell";
import { MarketingHeader } from "@/components/landing/marketing-header";

export const metadata: Metadata = {
  title: "Why Vantera — Not Another LinkedIn Tool",
  description:
    "Sequencers wait for your instructions and never improve. Vantera starts from what's proven, shows its work, and gets smarter every week.",
  alternates: { canonical: "/why-vantera" },
};

const INTRO_PARAS = [
  "Almost every LinkedIn outreach tool is the same machine underneath: a sequencer. You write the messages, you guess the targeting, you set the steps — and it sends on a schedule. Tools like Waalaxy, Expandi, and Dripify all work this way. The thinking is yours; the tool is a pipe.",
  "That has a cost people rarely name: a sequencer is the best it will ever be on the day you configure it. If your messages don't land, nothing in the tool will fix them. It doesn't know what's working. It doesn't remember what won. It just keeps sending.",
  "Vantera is a different kind of system. It arrives already knowing what works, it measures every conversation it runs, and it gets smarter every week — while you stay in charge of every send.",
];

const COMPARISON: { dimension: string; sequencer: string; vantera: string }[] = [
  {
    dimension: "Day one",
    sequencer: "A blank editor. You write everything and hope.",
    vantera: "Proven plays, matched to your buyers, running from the first message.",
  },
  {
    dimension: "Over time",
    sequencer: "Frozen. It only changes when you rewrite it.",
    vantera: "Tests improvements, keeps winners, drops losers — smarter every week.",
  },
  {
    dimension: "What it shows you",
    sequencer: "A log of what you did.",
    vantera: "What's working, what it's testing, and why — with the results to back it.",
  },
  {
    dimension: "Message quality",
    sequencer: "Whatever you typed, sent to everyone.",
    vantera: "Only what passes quality and safety checks — and earned its spot on real conversations.",
  },
  {
    dimension: "Your account",
    sequencer: "Volume settings you can push too far.",
    vantera: "Human-like pacing and hard limits built in — not configurable past safe.",
  },
  {
    dimension: "Your role",
    sequencer: "Operator. The tool waits for instructions.",
    vantera: "Owner. You approve sends and set direction; the system does the thinking.",
  },
];

const FEEL_PARAS = [
  "The simplest way to say it: a sequencer is a megaphone you rent. Vantera is closer to a rep you hire — one who shows up already good, tells you what they're doing and why, and gets a little better every single week.",
  "That difference compounds. Six months in, a sequencer is exactly where it started. Vantera has six months of real conversations behind every message it sends.",
];

export default function WhyVanteraPage() {
  return (
    <MarketingShell>
      <section className="px-6 pt-36 pb-10 sm:pt-40 lg:px-8">
        <MarketingHeader
          eyebrow="The difference"
          title="Every other tool waits for instructions"
          subtitle="Vantera already knows what works — and gets smarter every week. Here's the honest comparison."
        />
      </section>

      <section className="px-6 pb-14 lg:px-8">
        <div className="mx-auto max-w-2xl space-y-5 text-[17px] leading-[1.78] text-[var(--ink-3)]">
          {INTRO_PARAS.map((t, i) => (
            <p key={i}>{t}</p>
          ))}
        </div>
      </section>

      {/* Comparison */}
      <section className="px-6 pb-20 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-center text-[1.6rem] font-semibold tracking-[-0.02em] text-foreground">
            A sequencer vs. Vantera
          </h2>
          <div className="mt-10 overflow-hidden rounded-2xl border border-[var(--hairline)] bg-white shadow-[var(--shadow-sm)]">
            {/* Column headers — desktop only; mobile rows carry their own mini-labels. */}
            <div className="hidden border-b border-[var(--hairline)] bg-[var(--cyan-tint)]/30 px-6 py-4 text-[12px] font-semibold uppercase tracking-[0.14em] text-[var(--ink-3)] sm:grid sm:grid-cols-[1fr_1.4fr_1.4fr]">
              <span />
              <span>A sequencer</span>
              <span className="text-[var(--cyan-strong)]">Vantera</span>
            </div>
            {COMPARISON.map((row, i) => (
              <div
                key={row.dimension}
                className={`grid grid-cols-1 gap-y-2.5 px-6 py-5 sm:grid-cols-[1fr_1.4fr_1.4fr] sm:gap-x-4 sm:gap-y-0 ${
                  i < COMPARISON.length - 1 ? "border-b border-[var(--hairline)]" : ""
                }`}
              >
                <span className="text-[14px] font-semibold text-foreground">{row.dimension}</span>
                <span className="flex items-start gap-2 text-[14px] leading-relaxed text-[var(--ink-3)]">
                  <Minus className="mt-1 size-3.5 shrink-0 text-[var(--ink-3)]/50" />
                  <span>
                    <span className="mr-1 font-semibold text-[var(--ink-4)] sm:hidden">
                      A sequencer:
                    </span>
                    {row.sequencer}
                  </span>
                </span>
                <span className="flex items-start gap-2 text-[14px] leading-relaxed text-[var(--ink-3)]">
                  <Check className="mt-1 size-3.5 shrink-0 text-[var(--cyan-strong)]" />
                  <span>
                    <span className="mr-1 font-semibold text-[var(--cyan-strong)] sm:hidden">
                      Vantera:
                    </span>
                    {row.vantera}
                  </span>
                </span>
              </div>
            ))}
          </div>
          <p className="mx-auto mt-5 max-w-2xl text-center text-[13px] leading-relaxed text-[var(--ink-3)]/80">
            Sequencers are good at what they do — sending on a schedule. The comparison is about
            what they can&apos;t do: know what works, and improve.
          </p>
        </div>
      </section>

      {/* The feel */}
      <section className="px-6 pb-20 lg:px-8">
        <div className="mx-auto max-w-2xl space-y-5 rounded-2xl border border-[var(--hairline)] bg-white p-8 text-[16px] leading-[1.78] text-[var(--ink-3)] shadow-[var(--shadow-sm)]">
          {FEEL_PARAS.map((t, i) => (
            <p key={i}>{t}</p>
          ))}
        </div>
      </section>

      {/* Cross-links + CTA */}
      <section className="px-6 pb-24 sm:pb-28 lg:px-8">
        <div className="mx-auto grid max-w-3xl gap-5 sm:grid-cols-2">
          <Link
            href="/how-it-learns"
            className="group rounded-2xl border border-[var(--hairline)] bg-white p-6 shadow-[var(--shadow-sm)] transition-colors hover:border-[var(--cyan-strong)]/40"
          >
            <h3 className="text-[1.05rem] font-semibold tracking-[-0.01em] text-foreground">
              How the learning works
            </h3>
            <p className="mt-2 text-[14.5px] leading-relaxed text-[var(--ink-3)]">
              The whole loop in plain English — testing, keeping winners, hard safety lines.
            </p>
            <span className="mt-3 inline-flex items-center gap-1 text-[14px] font-medium text-[var(--cyan-strong)]">
              How it learns <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </span>
          </Link>
          <Link
            href="/proven-plays"
            className="group rounded-2xl border border-[var(--hairline)] bg-white p-6 shadow-[var(--shadow-sm)] transition-colors hover:border-[var(--cyan-strong)]/40"
          >
            <h3 className="text-[1.05rem] font-semibold tracking-[-0.01em] text-foreground">
              What it starts with
            </h3>
            <p className="mt-2 text-[14.5px] leading-relaxed text-[var(--ink-3)]">
              The proven plays behind &quot;good from the first message&quot; — and where they come
              from, honestly.
            </p>
            <span className="mt-3 inline-flex items-center gap-1 text-[14px] font-medium text-[var(--cyan-strong)]">
              Proven plays <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </span>
          </Link>
        </div>

        <div className="mx-auto mt-14 max-w-2xl text-center">
          <Link
            href="/signup"
            className="inline-flex items-center gap-1.5 rounded-full bg-[#0a0c12] px-5 py-2.5 text-[14px] font-medium text-white transition-all hover:shadow-[0_8px_24px_-8px_rgba(11,87,171,0.6)]"
          >
            Start free
            <ArrowRight className="size-4" />
          </Link>
          <p className="mt-3 text-[13px] text-[var(--ink-3)]">
            No credit card required · You approve every message
          </p>
        </div>
      </section>
    </MarketingShell>
  );
}
