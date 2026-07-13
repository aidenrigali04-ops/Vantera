import {
  PLAN_DISPLAY,
  PLAN_DISPLAY_ORDER,
  annualMonthlyUsd,
  annualYearlyUsd,
} from "@vantera/billing";
import dynamic from "next/dynamic";
import { LandingNav } from "@/components/landing/nav";
import { Hero } from "@/components/landing/hero";
import { TrustStrip } from "@/components/landing/trust-strip";
import { type LandingPlan } from "@/components/landing/pricing";
import type { Metadata } from "next";
import { JsonLd, softwareApplicationLd } from "@/lib/seo";

// Below-the-fold sections are code-split so their (animation-heavy) client JS lands in
// separate chunks instead of the initial bundle — the above-the-fold hero hydrates first
// and the main thread isn't monopolised in the LCP/TTI window (mobile perf). ssr stays on
// (the default) so the content is still server-rendered for SEO and there's no layout shift.
const Showcase = dynamic(() => import("@/components/landing/showcase").then((m) => m.Showcase));
const HowItWorks = dynamic(() => import("@/components/landing/how-it-works").then((m) => m.HowItWorks));
const FeaturesGrid = dynamic(() => import("@/components/landing/features-grid").then((m) => m.FeaturesGrid));
const Consolidation = dynamic(() => import("@/components/landing/consolidation").then((m) => m.Consolidation));
const Integrations = dynamic(() => import("@/components/landing/integrations").then((m) => m.Integrations));
const Pricing = dynamic(() => import("@/components/landing/pricing").then((m) => m.Pricing));
const FinalCta = dynamic(() => import("@/components/landing/final-cta").then((m) => m.FinalCta));
const LandingFooter = dynamic(() => import("@/components/landing/footer").then((m) => m.LandingFooter));

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
        <Integrations />
        <Pricing plans={plans} />
        <FinalCta />
      </main>
      <LandingFooter />
    </div>
  );
}
