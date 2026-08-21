import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { MarketingShell } from "@/components/landing/marketing-shell";
import { MarketingHeader } from "@/components/landing/marketing-header";
import { CARD_INTERACTIVE, Reveal, RevealItem } from "@/components/landing/surface";
import { JsonLd, breadcrumbLd, SITE_URL } from "@/lib/seo";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Case Studies — Results from Teams Running Vantera",
  description:
    "How sales teams use Vantera to book more meetings on LinkedIn — quality-first prospecting, in-market intent, and outreach they approve. See the numbers.",
  alternates: { canonical: "/case-studies" },
};

type CaseStudy = {
  company: string;
  initials: string;
  segment: string;
  metric: string;
  metricLabel: string;
  summary: string;
  href: string;
};

// Placeholder data — swap each entry for a real customer story as it ships.
const CASE_STUDIES: CaseStudy[] = [
  {
    company: "Company placeholder",
    initials: "NW",
    segment: "B2B SaaS · Seed",
    metric: "3.2×",
    metricLabel: "reply rate",
    summary: "Replaced a volume tool with intent-qualified outreach and tripled replies in the first month.",
    href: "#",
  },
  {
    company: "Company placeholder",
    initials: "AV",
    segment: "Agency · 20 seats",
    metric: "42",
    metricLabel: "meetings / mo",
    summary: "One SDR now books what three used to, with every message approved before it sends.",
    href: "#",
  },
  {
    company: "Company placeholder",
    initials: "LR",
    segment: "Fintech · Series A",
    metric: "0",
    metricLabel: "account flags",
    summary: "Scaled to 90 invites a week with zero LinkedIn restrictions thanks to enforced safety pacing.",
    href: "#",
  },
  {
    company: "Company placeholder",
    initials: "QS",
    segment: "DevTools · Series B",
    metric: "58%",
    metricLabel: "less prospecting time",
    summary: "Reps stopped hunting for leads and spent the reclaimed hours on qualified conversations.",
    href: "#",
  },
  {
    company: "Company placeholder",
    initials: "HM",
    segment: "Consulting · 8 seats",
    metric: "5×",
    metricLabel: "pipeline",
    summary: "In-market intent surfaced buyers the team never would have found with static lists.",
    href: "#",
  },
  {
    company: "Company placeholder",
    initials: "BF",
    segment: "Marketplace · Growth",
    metric: "27%",
    metricLabel: "invite→reply",
    summary: "Messages drafted from real activity beat their old templates by a wide margin.",
    href: "#",
  },
];

export default function CaseStudiesPage() {
  return (
    <MarketingShell>
      <JsonLd
        data={breadcrumbLd([
          { name: "Home", url: SITE_URL },
          { name: "Case Studies", url: `${SITE_URL}/case-studies` },
        ])}
      />

      <section className="px-6 pt-36 pb-12 sm:pt-40 lg:px-8">
        <MarketingHeader
          eyebrow="Case studies"
          title="Results from teams running Vantera"
          subtitle="Real numbers from teams that swapped volume for quality — more of the right conversations, on LinkedIn, on their approval."
        />
      </section>

      <section className="relative py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-6 lg:px-8">
          <Reveal className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {CASE_STUDIES.map((study, i) => (
              <RevealItem key={i}>
                <Link
                  href={study.href}
                  className={cn(CARD_INTERACTIVE, "group flex h-full flex-col p-6")}
                >
                  <div className="flex items-center gap-3">
                    <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl bg-[var(--cyan-tint)] text-[13px] font-semibold tracking-wide text-[var(--cyan-strong)]">
                      {study.initials}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-[14.5px] font-semibold text-foreground">{study.company}</p>
                      <p className="truncate text-[12.5px] text-[var(--ink-4)]">{study.segment}</p>
                    </div>
                  </div>

                  <div className="mt-6 flex items-baseline gap-2">
                    <span className="text-[2.1rem] font-semibold leading-none tracking-[-0.03em] text-foreground">
                      {study.metric}
                    </span>
                    <span className="text-[13px] font-medium text-[var(--cyan-strong)]">{study.metricLabel}</span>
                  </div>

                  <p className="mt-4 flex-1 text-[14px] leading-relaxed text-[var(--ink-3)]">{study.summary}</p>

                  <span className="mt-6 inline-flex items-center gap-1 text-[13px] font-medium text-[var(--cyan-strong)]">
                    Read story
                    <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </Link>
              </RevealItem>
            ))}
          </Reveal>
        </div>
      </section>
    </MarketingShell>
  );
}
