import type { Metadata } from "next";
import { CalendarCheck, MessageSquare, Target } from "lucide-react";
import { MarketingShell } from "@/components/landing/marketing-shell";
import { MarketingHeader } from "@/components/landing/marketing-header";
import { PrimaryCta, SecondaryCta } from "@/components/landing/cta";

export const metadata: Metadata = {
  title: "Book a Demo — Vantera",
  description:
    "See Vantera on your own pipeline: how its agents find in-market buyers, qualify them to your ICP, and draft outreach you approve. Book a live walkthrough.",
  alternates: { canonical: "/demo" },
};

/** What a demo covers — set expectations so the ask feels concrete, not salesy. */
const AGENDA = [
  {
    icon: Target,
    title: "Your ICP, mapped live",
    body: "We take your website and target market and show how the agents would source and score your actual buyers.",
  },
  {
    icon: MessageSquare,
    title: "Real drafts, not slides",
    body: "See the messages the system writes from a prospect's activity — and the approve-before-send review flow.",
  },
  {
    icon: CalendarCheck,
    title: "A plan sized to your goals",
    body: "Senders, volume, and pacing scoped to your team — with account safety limits explained honestly.",
  },
];

export default function DemoPage() {
  return (
    <MarketingShell>
      <section className="px-6 pt-36 pb-10 sm:pt-40 lg:px-8">
        <MarketingHeader
          eyebrow="Book a demo"
          title="See it run on your pipeline"
          subtitle="A 30-minute walkthrough with the team — your ICP, your market, and exactly what the agents would do with it."
        />
      </section>

      <section className="px-6 pb-24 sm:pb-28 lg:px-8">
        <div className="mx-auto grid max-w-5xl gap-5 sm:grid-cols-3">
          {AGENDA.map((a) => (
            <div
              key={a.title}
              className="rounded-2xl border border-[var(--hairline)] bg-white p-6 shadow-[var(--shadow-sm)]"
            >
              <span className="inline-flex size-10 items-center justify-center rounded-xl bg-[var(--cyan-tint)] text-[var(--cyan-strong)]">
                <a.icon className="size-5" />
              </span>
              <h2 className="mt-4 text-[1.15rem] font-semibold tracking-[-0.01em] text-foreground">{a.title}</h2>
              <p className="mt-2.5 text-[14.5px] leading-relaxed text-[var(--ink-3)]">{a.body}</p>
            </div>
          ))}
        </div>

        <div className="mx-auto mt-14 flex max-w-2xl flex-col items-center gap-4 text-center">
          <PrimaryCta href="mailto:sales@vanterasystem.com?subject=Vantera%20demo" size="lg">
            Book a demo
          </PrimaryCta>
          <p className="text-[13px] text-[var(--ink-4)]">
            Email us and we&apos;ll reply with times — usually within one business day.
          </p>
          <p className="mt-2 text-[14px] text-[var(--ink-3)]">
            Prefer to see it yourself first?
          </p>
          <SecondaryCta href="/signup">Start free instead</SecondaryCta>
        </div>
      </section>
    </MarketingShell>
  );
}
