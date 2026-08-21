import type { Metadata } from "next";
import { MarketingShell } from "@/components/landing/marketing-shell";
import { TrustStrip } from "@/components/landing/trust-strip";
import { Integrations } from "@/components/landing/integrations";
import { JsonLd, breadcrumbLd, faqPageLd, SITE_URL } from "@/lib/seo";
import { UseCaseHero } from "./use-case-hero";
import { ProblemSection } from "./problem-section";
import { WorkflowCompare } from "./workflow-compare";
import { BenefitTiles } from "./benefit-tiles";
import { FeatureShowcase } from "./feature-showcase";
import { ReviewQueueShowcase } from "./review-queue-showcase";
import { PipelineViz } from "./pipeline-viz";
import { OutcomesBand } from "./outcomes-band";
import { RoiCalculator } from "./roi-calculator";
import { UseCaseFaq } from "./use-case-faq";
import { RelatedUseCases } from "./related-use-cases";
import { UseCaseFinalCta } from "./use-case-final-cta";
import { useCaseBySlug } from "./registry";
import type { UseCaseContent } from "./types";

/** Per-page metadata from the content's SEO block — identical shape across every persona. */
export function buildUseCaseMetadata(content: UseCaseContent): Metadata {
  const url = `${SITE_URL}/use-cases/${content.slug}`;
  return {
    title: content.seo.title,
    description: content.seo.description,
    alternates: { canonical: `/use-cases/${content.slug}` },
    openGraph: { title: content.seo.title, description: content.seo.description, url, type: "website" },
  };
}

/**
 * The shared use-case page body — one composition for every persona. Everything specific
 * to a page lives in its `content` object; the structured data (Breadcrumb + FAQPage +
 * HowTo + Service) is derived from `content` + the registry so it can never drift from the
 * visible copy. Server component.
 */
export function UseCasePageBody({ content }: { content: UseCaseContent }) {
  const summary = useCaseBySlug(content.slug);
  const persona = summary?.persona ?? "teams";
  const serviceName = summary?.title ?? content.seo.title;
  const pageUrl = `${SITE_URL}/use-cases/${content.slug}`;

  const howToLd = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: content.pipeline.title,
    description: content.pipeline.subtitle,
    step: content.pipeline.howto.map((s, i) => ({
      "@type": "HowToStep",
      position: i + 1,
      name: s.name,
      text: s.text,
    })),
  };

  const serviceLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    serviceType: `LinkedIn automation for ${persona.toLowerCase()}`,
    name: serviceName,
    description: content.seo.description,
    url: pageUrl,
    provider: { "@type": "Organization", name: "Vantera", url: SITE_URL },
    areaServed: "Worldwide",
  };

  return (
    <MarketingShell>
      <JsonLd
        data={[
          breadcrumbLd([
            { name: "Home", url: SITE_URL },
            { name: "Use cases", url: `${SITE_URL}/use-cases` },
            { name: `For ${persona.toLowerCase()}`, url: pageUrl },
          ]),
          faqPageLd(content.faq.items),
          howToLd,
          serviceLd,
        ]}
      />

      <UseCaseHero content={content.hero} />
      <TrustStrip />
      <ProblemSection content={content.problem} />
      <WorkflowCompare content={content.compare} />
      <BenefitTiles content={content.benefits} />
      <FeatureShowcase content={content.features} />
      <ReviewQueueShowcase content={content.review} />
      <PipelineViz content={content.pipeline} />
      <OutcomesBand content={content.outcomes} />
      <Integrations />
      <RoiCalculator content={content.roi} />
      <UseCaseFaq content={content.faq} />
      <RelatedUseCases currentSlug={content.slug} tint={false} />
      <UseCaseFinalCta content={content.finalCta} />
    </MarketingShell>
  );
}
