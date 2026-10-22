import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, PlusCircle, Tag, UserPlus, Users } from "lucide-react";
import { ADDON_DISPLAY, TRIAL_DAYS } from "@vantera/billing";
import { cn } from "@/lib/utils";
import { LandingNav } from "@/components/landing/nav";
import { LandingFooter } from "@/components/landing/footer";
import { landingFont } from "@/components/landing/font";
import { Band, CELL, CellGrid, LINE, Pill, SectionHead, Accent, Spacer } from "@/components/landing/frame";
import { MarkDither } from "@/components/landing/hero-dither";
import { UrlForm } from "@/components/landing/url-form";
import { Pricing } from "@/components/landing/pricing";
import { Compare } from "@/components/landing/compare";
import { Guarantee } from "@/components/landing/guarantee";
import { FaqHome } from "@/components/landing/faq-home";
import { FinalCta } from "@/components/landing/final-cta";
import { CTA_REASSURANCE } from "@/components/landing/claims";
import { getLandingPlans, headlinePlan } from "@/lib/landing-plans";
import { JsonLd, SITE_URL, breadcrumbLd } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Pricing — Vantera",
  description:
    "One plan for all of Vantera: agents that find in-market buyers, qualify them, and run your LinkedIn outreach on autopilot. Free 7-day trial, cancel anytime.",
  alternates: { canonical: "/pricing" },
};

const ADDON_ICONS = { seat: UserPlus, linkedinAccount: Users } as const;

/**
 * /pricing — the homepage's pricing band given a page of its own, after rankbox.xyz's
 * pricing page, in the homepage's frame: a hero with the plan's facts (read from the
 * billing source of truth, never hardcoded), the plan cards, the add-ons, the
 * comparison, the zero-risk guarantee, the FAQ, and the closing band.
 */
export default function PricingPage() {
  const plans = getLandingPlans();
  const plan = headlinePlan(plans);
  const facts = plan
    ? [
        { value: `$${plan.monthlyUsd}`, label: "a month, everything included" },
        { value: `${TRIAL_DAYS} days`, label: "free trial to start" },
        { value: `$${plan.annualMonthlyUsd}`, label: "a month, billed yearly" },
        { value: "Anytime", label: "cancel, no long-term contract" },
      ]
    : [];

  return (
    <div className={`landing ${landingFont.variable} relative min-h-screen w-full overflow-x-clip bg-white`}>
      <JsonLd
        data={breadcrumbLd([
          { name: "Home", url: SITE_URL },
          { name: "Pricing", url: `${SITE_URL}/pricing` },
        ])}
      />
      <LandingNav framed />
      <main>
        <section aria-labelledby="pricing-title" className="relative bg-white">
          <div className={cn("relative mx-auto max-w-6xl overflow-hidden border-x", LINE)}>
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 opacity-[0.42] [mask-image:radial-gradient(ellipse_66%_82%_at_50%_50%,#000_50%,transparent_100%)]"
            >
              <MarkDither />
            </div>
            <div className="relative flex flex-col items-center px-5 pb-16 pt-7 text-center sm:px-8 sm:pb-20 sm:pt-9 lg:pb-[5.5rem]">
              <nav aria-label="Breadcrumb">
                <ol className="flex items-center gap-1.5 text-[0.78rem] text-[var(--ink-3)]">
                  <li>
                    <Link href="/" className="py-2 transition-colors hover:text-foreground">
                      Home
                    </Link>
                  </li>
                  <li aria-hidden>
                    <ChevronRight className="size-3" />
                  </li>
                  <li aria-current="page" className="font-medium text-foreground">
                    Pricing
                  </li>
                </ol>
              </nav>
              <div className="mt-10 sm:mt-12">
                <Pill icon={Tag}>Simple pricing</Pill>
              </div>
              <h1
                id="pricing-title"
                className="mt-6 text-[2.3rem] font-medium leading-[1.08] tracking-[-0.035em] text-foreground min-[400px]:text-[2.6rem] sm:text-[3.5rem] lg:text-[4.15rem]"
              >
                <span className="block">One plan,</span>{" "}
                <span className="mt-[0.04em] inline-flex items-center gap-[0.22em] whitespace-nowrap">
                  <span
                    aria-hidden
                    className="inline-flex size-[0.84em] shrink-0 items-center justify-center rounded-[0.2em] border border-[rgba(12,16,26,0.08)] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.06)]"
                  >
                    <Tag className="size-[48%] text-[var(--fb)]" strokeWidth={2.4} />
                  </span>
                  <span className="font-bold text-[var(--fb)]">all of Vantera</span>
                </span>
              </h1>
              <p className="mt-6 max-w-[41rem] text-balance text-[1.05rem] leading-relaxed text-[var(--ink-3)] sm:text-[1.15rem]">
                {plan
                  ? `${plan.name} is $${plan.monthlyUsd} a month after a free ${TRIAL_DAYS}-day trial: every agent, machine-learned targeting, and outreach that runs on autopilot. No contracts, cancel anytime.`
                  : `Every agent, machine-learned targeting, and outreach that runs on autopilot, with a free ${TRIAL_DAYS}-day trial. No contracts, cancel anytime.`}
              </p>
              <div className="mt-9 w-full max-w-[37rem]">
                <UrlForm />
                <p className="mt-3.5 text-[0.82rem] text-[var(--ink-3)]">{CTA_REASSURANCE}</p>
              </div>
            </div>
          </div>
          {facts.length > 0 && (
            <div className={cn("border-t", LINE)}>
              <div className={cn("mx-auto max-w-6xl border-x", LINE)}>
                <CellGrid className="grid-cols-2 md:grid-cols-4">
                  {facts.map((s) => (
                    <li
                      key={s.label}
                      className={cn(CELL, "flex flex-col items-center justify-center px-4 py-6 text-center sm:py-7")}
                    >
                      <p className="text-[1.45rem] font-medium leading-none tracking-[-0.02em] text-foreground sm:text-[1.6rem]">
                        {s.value}
                      </p>
                      <p className="mt-2 max-w-[13rem] text-balance text-[0.8rem] leading-snug text-[var(--ink-3)]">
                        {s.label}
                      </p>
                    </li>
                  ))}
                </CellGrid>
              </div>
            </div>
          )}
        </section>

        <Spacer />
        <Pricing plans={plans} />

        <Spacer />
        <section aria-labelledby="addons-title">
          <SectionHead
            icon={PlusCircle}
            eyebrow="Add-ons"
            title={
              <span id="addons-title">
                Grow when <Accent>you&rsquo;re ready</Accent>
              </span>
            }
            subtitle="Add teammates and LinkedIn senders to the plan you're on, on the same invoice."
          />
          <Band>
            <CellGrid className="sm:grid-cols-2">
              {ADDON_DISPLAY.map((a) => {
                const Icon = ADDON_ICONS[a.key];
                return (
                  <li key={a.key} className={cn(CELL, "flex gap-4 p-6 sm:p-8")}>
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-[rgba(12,16,26,0.08)] bg-white text-[var(--fb)] shadow-[0_1px_2px_rgba(16,24,40,0.05)]">
                      <Icon className="size-[18px]" />
                    </span>
                    <div>
                      <h3 className="text-[1.05rem] font-semibold tracking-tight text-foreground">{a.label}</h3>
                      <p className="mt-1 text-[0.9rem] leading-relaxed text-[var(--ink-3)]">{a.blurb}</p>
                    </div>
                  </li>
                );
              })}
            </CellGrid>
          </Band>
        </section>

        <Spacer />
        <Compare starterPriceUsd={plan?.monthlyUsd} />
        <Spacer />
        <Guarantee />
        <Spacer />
        <FaqHome />
        <Spacer />
        <FinalCta />
      </main>
      <LandingFooter framed />
    </div>
  );
}
