import { LandingNav } from "@/components/landing/nav";
import { Hero } from "@/components/landing/hero";
import { TrustStrip } from "@/components/landing/trust-strip";
import { Showcase } from "@/components/landing/showcase";
import { Conversations } from "@/components/landing/conversations";
import { HowItWorks } from "@/components/landing/how-it-works";
import { Features } from "@/components/landing/features";
import { Spacer } from "@/components/landing/frame";
import { Compare } from "@/components/landing/compare";
import { BuiltFor } from "@/components/landing/built-for";
import { Pricing } from "@/components/landing/pricing";
import { Guarantee } from "@/components/landing/guarantee";
import { FaqHome } from "@/components/landing/faq-home";
import { FinalCta } from "@/components/landing/final-cta";
import { LandingFooter } from "@/components/landing/footer";
import { FAQ_ITEMS } from "@/components/landing/faq-data";
import type { Metadata } from "next";
import { JsonLd, faqPageLd, softwareApplicationLd } from "@/lib/seo";
import { landingFont } from "@/components/landing/font";
import { getLandingPlans, headlinePlan } from "@/lib/landing-plans";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

export default function Home() {
  // Real plan data from the billing source of truth — never hardcoded marketing prices.
  const plans = getLandingPlans();

  return (
    // `.landing` scopes the premium light system (white + blue, set in the marketing
    // typeface from components/landing/font.ts) so the dashboard/auth surfaces are
    // untouched (globals.css). The page follows rankbox.xyz section for section: one
    // frame with hairline rails from the nav to the footer, every section a band, and an
    // empty spacer band between sections (components/landing/frame.tsx).
    <div className={`landing ${landingFont.variable} relative min-h-screen w-full overflow-x-clip bg-white`}>
      {/* Homepage entity + offer + FAQ content for Google rich results and AI engines.
          The FAQ schema mirrors the visible FAQ section (same FAQ_ITEMS source). */}
      <JsonLd data={[softwareApplicationLd(plans), faqPageLd(FAQ_ITEMS)]} />
      <LandingNav framed />
      <main>
        <Hero />
        <TrustStrip />
        <Showcase />
        <Spacer />
        <Conversations />
        <Spacer />
        <HowItWorks />
        <Spacer />
        <Features />
        <Spacer />
        <Compare starterPriceUsd={headlinePlan(plans)?.monthlyUsd} />
        <Spacer />
        <BuiltFor />
        <Spacer />
        <Pricing plans={plans} />
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
