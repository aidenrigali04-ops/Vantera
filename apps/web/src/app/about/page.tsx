import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CheckCircle2, ShieldCheck, Target } from "lucide-react";
import { MarketingShell } from "@/components/landing/marketing-shell";
import { MarketingHeader } from "@/components/landing/marketing-header";

export const metadata: Metadata = {
  title: "About Vantera — Quality-First LinkedIn Automation",
  description:
    "Why we built Vantera: a quality-first, safety-first LinkedIn automation system that reaches the right people — on your approval, without risking your account.",
  alternates: { canonical: "/about" },
};

const INTRO_PARAS = [
  "Most LinkedIn outreach is broken in the same way: it optimizes for volume. Send more invites, run more sequences, contact more people — and watch reply rates fall as your prospects' patience and your account's standing quietly wear down.",
  "We think that's backwards. The number that matters isn't how many people you reach — it's how many of the right people you reach at the right moment. So we built Vantera to find the people actually in-market, qualify them against your ICP, and write each message from their real activity. You approve every send, and account safety is enforced, not optional.",
  "The result is outreach that feels less like a machine and more like your sharpest rep — one who only ever reaches out when there's a genuine reason to.",
];

const PRINCIPLES = [
  {
    icon: Target,
    title: "Qualify, don't spray",
    body: "Every prospect clears an ICP-fit and real-intent bar before anyone is contacted. Fewer, sharper conversations beat thousands of ignored invites.",
  },
  {
    icon: CheckCircle2,
    title: "You stay in control",
    body: "Nothing sends without your approval. Agents draft each message from real activity; you approve, edit, or skip every one.",
  },
  {
    icon: ShieldCheck,
    title: "Safety is built in",
    body: "Human-like pacing and hard limits live in the scheduler, non-configurable below safe thresholds — your account is protected by design.",
  },
];

export default function AboutPage() {
  return (
    <MarketingShell>
      <section className="px-6 pt-36 pb-10 sm:pt-40 lg:px-8">
        <MarketingHeader
          eyebrow="About"
          title="Why we built Vantera"
          subtitle="Manual prospecting doesn't scale, and volume tools spray strangers and risk the account you run on. We built the alternative."
        />
      </section>

      <section className="px-6 pb-12 lg:px-8">
        <div className="mx-auto max-w-2xl space-y-5 text-[17px] leading-[1.78] text-[var(--ink-3)]">
          {INTRO_PARAS.map((t, i) => (
            <p key={i}>{t}</p>
          ))}
        </div>
      </section>

      <section className="px-6 pb-24 sm:pb-28 lg:px-8">
        <div className="mx-auto grid max-w-5xl gap-5 sm:grid-cols-3">
          {PRINCIPLES.map((p) => (
            <div
              key={p.title}
              className="rounded-2xl border border-[var(--hairline)] bg-white p-6 shadow-[var(--shadow-sm)]"
            >
              <span className="inline-flex size-10 items-center justify-center rounded-xl bg-[var(--cyan-tint)] text-[var(--cyan-strong)]">
                <p.icon className="size-5" />
              </span>
              <h2 className="mt-4 text-[1.15rem] font-semibold tracking-[-0.01em] text-foreground">{p.title}</h2>
              <p className="mt-2.5 text-[14.5px] leading-relaxed text-[var(--ink-3)]">{p.body}</p>
            </div>
          ))}
        </div>

        <div className="mx-auto mt-14 max-w-2xl text-center">
          <Link
            href="/signup"
            className="inline-flex items-center gap-1.5 rounded-full bg-[#0a0c12] px-5 py-2.5 text-[14px] font-medium text-white transition-all hover:shadow-[0_8px_24px_-8px_rgba(11, 87, 171,0.6)]"
          >
            Start free
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </section>
    </MarketingShell>
  );
}
