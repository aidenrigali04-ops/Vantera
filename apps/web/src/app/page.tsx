import {
  PLAN_DISPLAY,
  PLAN_DISPLAY_ORDER,
  annualMonthlyUsd,
  annualYearlyUsd,
} from "@vantera/billing";
import { LandingNav } from "@/components/landing/nav";
import { Hero } from "@/components/landing/hero";
import { TrustStrip } from "@/components/landing/trust-strip";
import { Showcase } from "@/components/landing/showcase";
import { HowItWorks } from "@/components/landing/how-it-works";
import { FeaturesGrid } from "@/components/landing/features-grid";
import { Consolidation } from "@/components/landing/consolidation";
import { Stats } from "@/components/landing/stats";
import { Testimonials } from "@/components/landing/testimonials";
import { Integrations } from "@/components/landing/integrations";
import { Pricing, type LandingPlan } from "@/components/landing/pricing";
import { FinalCta } from "@/components/landing/final-cta";
import { LandingFooter } from "@/components/landing/footer";
import type { Metadata } from "next";
import { JsonLd, softwareApplicationLd } from "@/lib/seo";

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
      {/* Homepage entity + offer content for Google rich results and AI engines. */}
      <JsonLd data={[softwareApplicationLd(plans)]} />
      <LandingNav />
      <main>
        {/* Hero + social proof are one above-the-fold screen on lg+. */}
        <div className="lg:flex lg:min-h-[100svh] lg:flex-col">
          <Hero />
          <TrustStrip />
        </div>
        {/* 3 → 12 */}
        <Showcase />
        <HowItWorks />
        <FeaturesGrid />
        <Consolidation />
        <Stats />
        <Testimonials />
        <Integrations />
        <Pricing plans={plans} />
        <FinalCta />
      </main>
      <LandingFooter />
    </div>
  );
}
