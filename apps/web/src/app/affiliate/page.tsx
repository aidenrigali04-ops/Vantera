import type { Metadata } from "next";
import { Handshake, TrendingUp, Users } from "lucide-react";
import { MarketingShell } from "@/components/landing/marketing-shell";
import { MarketingHeader } from "@/components/landing/marketing-header";
import { PrimaryCta } from "@/components/landing/cta";

export const metadata: Metadata = {
  title: "Affiliate Program — Vantera",
  description:
    "Partner with Vantera: recommend quality-first LinkedIn automation to your audience or clients and earn a recurring share of every subscription you refer.",
  alternates: { canonical: "/affiliate" },
};

const WHO = [
  {
    icon: Users,
    title: "Creators & communities",
    body: "You talk to founders, sales leaders, or operators who run outbound on LinkedIn and are tired of volume tools.",
  },
  {
    icon: Handshake,
    title: "Agencies & consultants",
    body: "You set up outbound for clients and want a system you can hand over that keeps their accounts safe.",
  },
  {
    icon: TrendingUp,
    title: "Operators with reach",
    body: "You use Vantera yourself and want a share of the subscriptions your recommendation drives.",
  },
];

export default function AffiliatePage() {
  return (
    <MarketingShell>
      <section className="px-6 pt-36 pb-10 sm:pt-40 lg:px-8">
        <MarketingHeader
          eyebrow="Affiliate program"
          title="Earn by recommending Vantera"
          subtitle="Refer people who should be running quality-first LinkedIn outbound, and earn a recurring share of every subscription that starts with you."
        />
      </section>

      <section className="px-6 pb-24 sm:pb-28 lg:px-8">
        <div className="mx-auto grid max-w-5xl gap-5 sm:grid-cols-3">
          {WHO.map((w) => (
            <div
              key={w.title}
              className="rounded-2xl border border-[var(--hairline)] bg-white p-6 shadow-[var(--shadow-sm)]"
            >
              <span className="inline-flex size-10 items-center justify-center rounded-xl bg-[var(--cyan-tint)] text-[var(--cyan-strong)]">
                <w.icon className="size-5" />
              </span>
              <h2 className="mt-4 text-[1.15rem] font-semibold tracking-[-0.01em] text-foreground">{w.title}</h2>
              <p className="mt-2.5 text-[14.5px] leading-relaxed text-[var(--ink-3)]">{w.body}</p>
            </div>
          ))}
        </div>

        <div className="mx-auto mt-14 flex max-w-2xl flex-col items-center gap-4 text-center">
          <p className="text-[15px] leading-relaxed text-[var(--ink-3)]">
            The program is onboarding partners by hand right now — tell us about your audience or
            client base and we&apos;ll set you up with your terms and tracking link.
          </p>
          <PrimaryCta href="mailto:sales@vanterasystem.com?subject=Vantera%20affiliate%20program" size="lg">
            Apply to partner
          </PrimaryCta>
        </div>
      </section>
    </MarketingShell>
  );
}
