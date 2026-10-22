import type { Feature } from "@/lib/features";
import { Spacer } from "@/components/landing/frame";
import { Pricing, type LandingPlan } from "@/components/landing/pricing";
import { FaqHome } from "@/components/landing/faq-home";
import { VISUALS } from "./visuals";
import {
  FeatureBenefits,
  FeatureCta,
  FeatureEngine,
  FeatureExplore,
  FeatureHero,
  FeatureProblem,
  FeatureShowcase,
  FeatureSteps,
} from "./sections";

/**
 * One feature's page, after rankbox.xyz's feature layouts, in the homepage's rhythm:
 * hero and facts, the feature running on the painted sky, why it matters, what's
 * inside, how it works, where it sits in the engine, where to go next, then the same
 * pricing, FAQ, and closing band the homepage ends on. Blank spacer bands between
 * sections, as on the homepage.
 */
export function FeaturePage({ feature, plans }: { feature: Feature; plans: LandingPlan[] }) {
  const visuals = VISUALS[feature.slug as keyof typeof VISUALS];
  return (
    <>
      <FeatureHero feature={feature} />
      <FeatureShowcase feature={feature} visuals={visuals} />
      <Spacer />
      <FeatureProblem feature={feature} />
      <Spacer />
      <FeatureBenefits feature={feature} visuals={visuals} />
      <Spacer />
      <FeatureSteps feature={feature} visuals={visuals} />
      <Spacer />
      <FeatureEngine feature={feature} />
      <Spacer />
      <FeatureExplore feature={feature} />
      <Spacer />
      <Pricing plans={plans} />
      <Spacer />
      <FaqHome
        items={feature.faqs}
        title={`${feature.name} questions`}
        subtitle={`Everything you need to know about ${feature.name.toLowerCase()} and how it fits into Vantera.`}
      />
      <Spacer />
      <FeatureCta feature={feature} visuals={visuals} />
    </>
  );
}
