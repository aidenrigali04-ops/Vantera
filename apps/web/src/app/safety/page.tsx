import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { MarketingShell } from "@/components/landing/marketing-shell";
import { MarketingHeader } from "@/components/landing/marketing-header";
import { JsonLd, breadcrumbLd } from "@/lib/seo";

export const metadata: Metadata = {
  title: "How Vantera Keeps Your LinkedIn Account Safe",
  description:
    "The exact mechanisms behind Vantera's account safety: login custody, hard weekly ceilings, randomized human-like pacing, warmup for new accounts, and auto-pause on security checks.",
  alternates: { canonical: "/safety" },
};

/**
 * /safety — the plain-language safety doc the homepage S3 section links to (blueprint
 * §7/S3). Four headings, the real numbers, and the honest sentence no competitor
 * prints. Server component, text only.
 */

const SECTIONS: { title: string; body: React.ReactNode }[] = [
  {
    title: "Custody",
    body: (
      <>
        You sign in through LinkedIn&rsquo;s own flow — your password never touches Vantera.
        Two-factor prompts and security checkpoints happen inside LinkedIn&rsquo;s pages, exactly as
        they would if you logged in yourself. What Vantera receives is a connection to act on your
        behalf; what it stores about your login is nothing.
      </>
    ),
  },
  {
    title: "Pacing",
    body: (
      <>
        Every action fires with randomized, human-like gaps — never bursts, never clockwork
        intervals. Invites stay under a hard ceiling of roughly 100 per week per account, and daily
        volume is bounded well below anything that looks automated. These limits live in
        Vantera&rsquo;s scheduler, not in a settings page: there is no toggle that raises them past
        the safe line, for you or for us. When you connect more than one sender, volume is
        distributed across accounts so no single profile ever carries risky volume.
      </>
    ),
  },
  {
    title: "Warmup",
    body: (
      <>
        New or long-quiet accounts don&rsquo;t start at the ceiling. They begin at a fraction of it
        and ramp up gradually over the first weeks, the way a person returning to active outreach
        would. The ramp is automatic — nothing for you to configure, nothing you can skip.
      </>
    ),
  },
  {
    title: "What happens when LinkedIn asks for a check",
    body: (
      <>
        If LinkedIn raises a security checkpoint on your account, everything on that account pauses
        immediately — sends, invites, follow-ups. You resolve the check in LinkedIn&rsquo;s own
        flow, and when the account is clear, held messages resume at normal pace, never all at
        once. One honest sentence to close on: no tool can guarantee LinkedIn will never act. What
        Vantera guarantees is that every ceiling, gap, and pause is designed around typical human
        behavior — and enforced where you can&rsquo;t accidentally turn it off.
      </>
    ),
  },
];

export default function SafetyPage() {
  return (
    <MarketingShell>
      <JsonLd
        data={[
          breadcrumbLd([
            { name: "Home", url: "/" },
            { name: "Safety", url: "/safety" },
          ]),
        ]}
      />

      <section className="px-6 pt-36 pb-10 sm:pt-40 lg:px-8">
        <MarketingHeader
          eyebrow="Account safety"
          title="How pacing works"
          subtitle="The mechanisms behind every send — stated plainly, with the real numbers."
        />
      </section>

      <section className="px-6 pb-20 sm:pb-24 lg:px-8">
        <div className="mx-auto max-w-2xl">
          <div className="flex flex-col gap-10">
            {SECTIONS.map((s) => (
              <div key={s.title}>
                <h2 className="text-[21px] font-semibold tracking-[-0.02em] text-foreground">
                  {s.title}
                </h2>
                <p className="mt-3 text-[15.5px] leading-relaxed text-[var(--ink-3)]">{s.body}</p>
              </div>
            ))}
          </div>

          <div className="mt-14 flex flex-col items-center gap-3 border-t border-[var(--hairline)] pt-10 text-center">
            <p className="text-[14.5px] text-[var(--ink-3)]">
              See what your first queue looks like — nothing sends without your approval.
            </p>
            <Link
              href="/signup"
              className="inline-flex items-center gap-1.5 rounded-full bg-[var(--fb)] px-6 py-3 text-[14px] font-semibold text-white transition-all hover:bg-[var(--fb-strong)] hover:shadow-[0_8px_24px_-8px_rgba(24,119,242,0.55)]"
            >
              Get started free
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}
