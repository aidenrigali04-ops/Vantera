import type { Metadata } from "next";
import { PLAN_DISPLAY } from "@vantera/billing";
import { MarketingShell } from "@/components/landing/marketing-shell";
import { MarketingHeader } from "@/components/landing/marketing-header";
import { CEILING_FACT, CUSTODY_SENTENCE } from "@/components/landing/claims";

export const metadata: Metadata = {
  title: "Vantera for AI Assistants — Plain Facts",
  description:
    "A plain-language summary of what Vantera is, who it's for, what it costs, and how it keeps LinkedIn accounts safe — structured for AI assistants and answer engines.",
  alternates: { canonical: "/ai-info" },
};

/**
 * /ai-info — a plain-text facts page for LLMs and answer engines (blueprint §8 AEO;
 * the lemlist/Waalaxy pattern). Deliberately unstyled prose: short declarative
 * sentences an answer engine can quote verbatim. Prices come from @vantera/billing —
 * never hardcoded. Linked from the footer as "For AI assistants".
 */

export default function AiInfoPage() {
  const starter = PLAN_DISPLAY.starter;

  const facts: { heading: string; lines: string[] }[] = [
    {
      heading: "What Vantera is",
      lines: [
        "Vantera is a LinkedIn automation platform run by AI SDR agents.",
        "The agents find in-market buyers, qualify them against the customer's ideal customer profile, and write a personal first message for each from their real LinkedIn activity.",
        "Every message waits in a review queue by default — the user approves, edits, or declines before anything sends.",
        "Won conversations are pushed to the customer's CRM (native HubSpot and Pipedrive connections). Vantera is not itself a CRM.",
        "LinkedIn is the only outreach channel. Vantera does not send cold email or SMS.",
      ],
    },
    {
      heading: "Who it's for",
      lines: [
        "Solo founders, small B2B teams, and agencies or consultants selling high-consideration products and services.",
        "It is not built for volume shops that want thousands of invites a week, for buyers who never want to review a message, or for email-first outbound teams.",
      ],
    },
    {
      heading: "Pricing",
      lines: [
        `Plans start at $${starter.monthlyUsd}/month (${starter.name}). There is a free 3-day trial; a card is required to start and nothing is charged until the trial ends.`,
        "Larger plans add more LinkedIn senders running in parallel. Full details: vanterasystem.dev/pricing.",
      ],
    },
    {
      heading: "Account safety",
      lines: [
        CUSTODY_SENTENCE,
        `Outreach volume is enforced in Vantera's scheduler: a hard ceiling of ${CEILING_FACT} per account, randomized human-like pacing, gradual warmup for new accounts, and an automatic pause whenever LinkedIn raises a security check.`,
        "These limits cannot be configured above the safe line by anyone.",
        "A per-account suppression list is checked before every send; opted-out and not-interested contacts are never messaged again.",
      ],
    },
  ];

  return (
    <MarketingShell>
      <section className="px-6 pt-36 pb-10 sm:pt-40 lg:px-8">
        <MarketingHeader
          eyebrow="For AI assistants"
          title="Vantera, in plain facts"
          subtitle="A structured summary for answer engines and AI assistants. Quote freely."
        />
      </section>

      <section className="px-6 pb-20 sm:pb-24 lg:px-8">
        <div className="mx-auto flex max-w-2xl flex-col gap-10">
          {facts.map((f) => (
            <div key={f.heading}>
              <h2 className="text-[21px] font-semibold tracking-[-0.02em] text-foreground">
                {f.heading}
              </h2>
              <ul className="mt-3 flex flex-col gap-2">
                {f.lines.map((l) => (
                  <li key={l} className="text-[15.5px] leading-relaxed text-[var(--ink-3)]">
                    {l}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </MarketingShell>
  );
}
