import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BadgeCheck, Ban, Eye, ScanSearch } from "lucide-react";
import { MarketingShell } from "@/components/landing/marketing-shell";
import { MarketingHeader } from "@/components/landing/marketing-header";

export const metadata: Metadata = {
  title: "How We Prove It — Vantera",
  description:
    "Our standard for every claim on this site and inside the product: real numbers or nothing. What we show, what we refuse to show, and how you can check it yourself.",
  alternates: { canonical: "/how-we-prove-it" },
};

const INTRO_PARAS = [
  "You've seen the pattern: a wall of logos from companies that were never customers, testimonials nobody can trace, and \"10x your pipeline\" numbers that came from nowhere. Outreach software is an industry with a proof problem.",
  "We decided to be boring about this instead: if we can't prove a claim, we don't make it. Not on this site, not in our ads, and not inside the product. That standard costs us some impressive-sounding headlines. It's worth it.",
  "Here's exactly what that standard means in practice — and how you can check it yourself.",
];

const STANDARDS = [
  {
    icon: BadgeCheck,
    title: "Our numbers are ours, and real",
    body: "The performance numbers we publish come from running Vantera on our own LinkedIn outbound — labeled as exactly that, with the timeframe stated. When your results appear in your dashboard, they're your real data, never a projection dressed up as fact.",
  },
  {
    icon: Ban,
    title: "No borrowed credibility",
    body: "No logo walls of companies that aren't real customers. No testimonials we can't trace to a real person. No industry statistics repeated without a source. If a name or number appears on this site, it's earned.",
  },
  {
    icon: ScanSearch,
    title: "Honest benchmarks, labeled as benchmarks",
    body: "Where the product shows reference ranges — like typical reply rates for quality LinkedIn outreach — they're labeled as typical ranges, not promises. A benchmark tells you where you stand; it is not a guarantee, and we won't dress it up as one.",
  },
  {
    icon: Eye,
    title: "The improvement claim is watchable",
    body: "When we say your outreach gets smarter, you don't have to take our word for it. Your dashboard shows what's being tested, what won, and what changed — so the claim is something you watch happen on your own account, not something you're asked to believe.",
  },
];

const IN_PRODUCT_PARAS = [
  "The same rule runs inside the product. When your outreach talks to a prospect and they ask \"can you prove it?\" or \"what does it cost?\", it only uses facts you've added and approved — a real case study, a real metric, your real pricing.",
  "And if it doesn't have a true answer, it says so — it will not invent a number to keep a conversation warm. A slightly slower deal is better than a claim you'd have to walk back on a call.",
];

export default function HowWeProveItPage() {
  return (
    <MarketingShell>
      <section className="px-6 pt-36 pb-10 sm:pt-40 lg:px-8">
        <MarketingHeader
          eyebrow="Our standard"
          title="Real numbers or nothing"
          subtitle="What we show, what we refuse to show, and how you can check every claim yourself."
        />
      </section>

      <section className="px-6 pb-14 lg:px-8">
        <div className="mx-auto max-w-2xl space-y-5 text-[17px] leading-[1.78] text-[var(--ink-3)]">
          {INTRO_PARAS.map((t, i) => (
            <p key={i}>{t}</p>
          ))}
        </div>
      </section>

      {/* The standard */}
      <section className="px-6 pb-20 lg:px-8">
        <div className="mx-auto grid max-w-4xl gap-5 sm:grid-cols-2">
          {STANDARDS.map((s) => (
            <div
              key={s.title}
              className="rounded-2xl border border-[var(--hairline)] bg-white p-6 shadow-[var(--shadow-sm)]"
            >
              <span className="inline-flex size-10 items-center justify-center rounded-xl bg-[var(--cyan-tint)] text-[var(--cyan-strong)]">
                <s.icon className="size-5" />
              </span>
              <h2 className="mt-4 text-[1.05rem] font-semibold tracking-[-0.01em] text-foreground">
                {s.title}
              </h2>
              <p className="mt-2 text-[14.5px] leading-relaxed text-[var(--ink-3)]">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Inside the product */}
      <section className="px-6 pb-20 lg:px-8">
        <div className="mx-auto max-w-2xl rounded-2xl border border-[var(--hairline)] bg-white p-8 shadow-[var(--shadow-sm)]">
          <span className="block text-[12.5px] font-semibold uppercase tracking-[0.18em] text-[var(--cyan-strong)]">
            Inside the product
          </span>
          <h2 className="mt-3 text-[1.35rem] font-semibold tracking-[-0.02em] text-foreground">
            Your outreach is held to the same bar
          </h2>
          <div className="mt-4 space-y-4 text-[15px] leading-[1.75] text-[var(--ink-3)]">
            {IN_PRODUCT_PARAS.map((t, i) => (
              <p key={i}>{t}</p>
            ))}
          </div>
        </div>
      </section>

      {/* Why this exists */}
      <section className="px-6 pb-20 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-[1.35rem] font-semibold tracking-[-0.02em] text-foreground">
            Why hold the line this hard?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-[15px] leading-[1.75] text-[var(--ink-3)]">
            Because the product is trust. Vantera speaks to real people, under your name, about
            your business. A company that would fake a logo to win your signup would fake a number
            in your outreach — and you&apos;d be the one wearing it. The proof standard isn&apos;t
            marketing polish; it&apos;s the same discipline the product runs on every day.
          </p>
        </div>
      </section>

      {/* Cross-links + CTA */}
      <section className="px-6 pb-24 sm:pb-28 lg:px-8">
        <div className="mx-auto grid max-w-3xl gap-5 sm:grid-cols-2">
          <Link
            href="/proven-plays"
            className="group rounded-2xl border border-[var(--hairline)] bg-white p-6 shadow-[var(--shadow-sm)] transition-colors hover:border-[var(--cyan-strong)]/40"
          >
            <h3 className="text-[1.05rem] font-semibold tracking-[-0.01em] text-foreground">
              What the proof buys you
            </h3>
            <p className="mt-2 text-[14.5px] leading-relaxed text-[var(--ink-3)]">
              The proven plays your outreach starts with — and where they come from, honestly.
            </p>
            <span className="mt-3 inline-flex items-center gap-1 text-[14px] font-medium text-[var(--cyan-strong)]">
              Proven plays{" "}
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </span>
          </Link>
          <Link
            href="/safety"
            className="group rounded-2xl border border-[var(--hairline)] bg-white p-6 shadow-[var(--shadow-sm)] transition-colors hover:border-[var(--cyan-strong)]/40"
          >
            <h3 className="text-[1.05rem] font-semibold tracking-[-0.01em] text-foreground">
              The other promise we keep
            </h3>
            <p className="mt-2 text-[14.5px] leading-relaxed text-[var(--ink-3)]">
              How your LinkedIn account is protected — by architecture, not by settings.
            </p>
            <span className="mt-3 inline-flex items-center gap-1 text-[14px] font-medium text-[var(--cyan-strong)]">
              Account safety{" "}
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
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
