import {
  PLAN_DISPLAY,
  PLAN_DISPLAY_ORDER,
  annualMonthlyUsd,
  annualYearlyUsd,
} from "@vantera/billing";
import { LandingNav } from "@/components/landing/nav";
import { Hero } from "@/components/landing/hero";
import { TrustStrip } from "@/components/landing/trust-strip";
import { HowItWorks } from "@/components/landing/how-it-works";
import { ApprovalGate } from "@/components/landing/approval-gate";
import { Safety } from "@/components/landing/safety";
import { EvidenceScoring } from "@/components/landing/evidence-scoring";
import { Replies } from "@/components/landing/replies";
import { Compare } from "@/components/landing/compare";
import { BuiltFor } from "@/components/landing/built-for";
import { Pricing, type LandingPlan } from "@/components/landing/pricing";
import { FaqHome } from "@/components/landing/faq-home";
import { FinalCta } from "@/components/landing/final-cta";
import { LandingFooter } from "@/components/landing/footer";
import { FAQ_ITEMS } from "@/components/landing/faq-data";
import type { Metadata } from "next";
import { JsonLd, faqPageLd, softwareApplicationLd } from "@/lib/seo";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

export default function Home() {
  // Real plan data from the billing source of truth — never hardcoded marketing prices.
  const plans: LandingPlan[] = PLAN_DISPLAY_ORDER.map((tier) => {
    const d = PLAN_DISPLAY[tier];
    return {
      tier: d.tier,
      name: d.name,
      tagline: d.tagline,
      monthlyUsd: d.monthlyUsd,
      annualMonthlyUsd: annualMonthlyUsd(d.monthlyUsd),
      annualYearlyUsd: annualYearlyUsd(d.monthlyUsd),
      highlight: d.highlight,
      features: d.features,
    };
  });

  return (
    // `.landing` scopes the 2026 premium light system (white + cyan + Poppins + dark
    // product panels) so the dark dashboard/auth surfaces are untouched (globals.css).
    <div className="landing relative min-h-screen w-full overflow-x-clip">
      {/* Homepage entity + offer + FAQ content for Google rich results and AI engines.
          The FAQ schema mirrors the visible S9 section (same FAQ_ITEMS source). */}
      <JsonLd data={[softwareApplicationLd(plans), faqPageLd(FAQ_ITEMS)]} />
      <LandingNav onDark />
      <main>
        {/* Hero + social proof are one above-the-fold screen on lg+. */}
        <div className="lg:flex lg:min-h-[100svh] lg:flex-col">
          <Hero />
          <TrustStrip />
        </div>
        {/* Below the fold: the blueprint's intent map — each section answers the
            visitor's next question, in the order they ask it (S0 → S10). */}
        <HowItWorks />
        <ApprovalGate />
        <Safety />
        <EvidenceScoring />
        <Replies />
        <Compare starterPriceUsd={plans.find((p) => p.tier === "starter")?.monthlyUsd} />
        <BuiltFor />
        <Pricing plans={plans} />
        <FaqHome />
        <FinalCta />
      </main>
      <LandingFooter />
    </div>
  );
}
