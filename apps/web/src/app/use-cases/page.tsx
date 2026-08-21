import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { MarketingShell } from "@/components/landing/marketing-shell";
import { MarketingHeader } from "@/components/landing/marketing-header";
import { Reveal, RevealItem } from "@/components/landing/surface";
import { UseCaseCard } from "@/components/landing/use-case/related-use-cases";
import { USE_CASES } from "@/components/landing/use-case/registry";
import { JsonLd, breadcrumbLd, SITE_URL } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Use Cases — LinkedIn Automation by Team | Vantera",
  description:
    "See how Vantera runs LinkedIn outreach for your team — sales teams, founders, agencies, and recruiters. AI SDR agents that qualify before they reach out, on your approval.",
  alternates: { canonical: "/use-cases" },
};

function itemListLd() {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Vantera use cases",
    itemListElement: USE_CASES.filter((u) => u.live).map((u, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: u.title,
      url: `${SITE_URL}/use-cases/${u.slug}`,
    })),
  };
}

export default function UseCasesHubPage() {
  return (
    <MarketingShell>
      <JsonLd
        data={[
          breadcrumbLd([
            { name: "Home", url: SITE_URL },
            { name: "Use cases", url: `${SITE_URL}/use-cases` },
          ]),
          itemListLd(),
        ]}
      />

      <section className="px-6 pt-36 pb-12 sm:pt-40 lg:px-8">
        <MarketingHeader
          eyebrow="Use cases"
          title="Built for the way your team sells"
          subtitle="Same system, tuned to your motion — AI SDR agents that find in-market buyers, qualify them against your ICP, and draft every message from real activity. You approve every send."
        />
      </section>

      <section className="relative pb-8 sm:pb-12">
        <div className="mx-auto max-w-5xl px-6 lg:px-8">
          <Reveal className="grid gap-5 sm:grid-cols-2">
            {USE_CASES.map((u) => (
              <RevealItem key={u.slug} className="h-full">
                <UseCaseCard item={u} />
              </RevealItem>
            ))}
          </Reveal>
        </div>
      </section>

      <section className="relative border-t border-[var(--hairline)] bg-[var(--tint)] py-20 sm:py-24">
        <div className="mx-auto max-w-2xl px-6 text-center lg:px-8">
          <h2 className="text-[1.7rem] font-semibold tracking-[-0.025em] text-foreground sm:text-[2rem]">
            Not sure which fits?
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-[15.5px] leading-relaxed text-[var(--ink-3)]">
            Start free and Vantera reads your site to map your ICP for you — no matter how your team is
            structured, the motion is the same: quality-first outreach, on your approval.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/signup"
              className="group inline-flex items-center gap-2 rounded-full bg-[var(--fb)] px-7 py-3.5 text-[15px] font-semibold text-white shadow-[0_6px_18px_-8px_rgba(24,119,242,0.4)] transition-all hover:bg-[var(--fb-strong)] hover:-translate-y-0.5"
            >
              Start free
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              href="/#pricing"
              className="inline-flex items-center gap-2 rounded-full border border-[var(--hairline)] bg-white px-7 py-3.5 text-[15px] font-semibold text-[var(--ink-2)] shadow-[var(--shadow-sm)] transition-all hover:-translate-y-0.5 hover:border-[var(--cyan-line)] hover:text-foreground"
            >
              See pricing
            </Link>
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}
