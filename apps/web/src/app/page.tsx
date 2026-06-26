import {
  PLAN_DISPLAY,
  PLAN_DISPLAY_ORDER,
  annualMonthlyUsd,
  annualYearlyUsd,
} from "@vantera/billing";
import { LandingNav } from "@/components/landing/nav";
import { Hero } from "@/components/landing/hero";
import { TrustStrip } from "@/components/landing/trust-strip";
import { FeaturesGrid } from "@/components/landing/features-grid";
import { Showcase } from "@/components/landing/showcase";
import { Results } from "@/components/landing/results";
import { Teams } from "@/components/landing/teams";
import { Pricing, type LandingPlan } from "@/components/landing/pricing";
import { Testimonials } from "@/components/landing/testimonials";
import { Capabilities } from "@/components/landing/capabilities";
import { Integrations } from "@/components/landing/integrations";
import { Faq } from "@/components/landing/faq";
import { FinalCta } from "@/components/landing/final-cta";
import { LandingFooter } from "@/components/landing/footer";

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
      <LandingNav />
      <main>
        <Hero />
        <TrustStrip />
        <FeaturesGrid />
        <Showcase />
        <Results />
        <Teams />
        <Pricing plans={plans} />
        <Testimonials />
        <Capabilities />
        <Integrations />
        <Faq />
        <FinalCta />
      </main>
      <LandingFooter />
    </div>
  );
}
