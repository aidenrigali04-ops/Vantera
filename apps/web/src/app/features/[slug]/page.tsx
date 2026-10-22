import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LandingNav } from "@/components/landing/nav";
import { LandingFooter } from "@/components/landing/footer";
import { landingFont } from "@/components/landing/font";
import { FeaturePage } from "@/components/features/feature-page";
import { FEATURES, getFeature } from "@/lib/features";
import { getLandingPlans } from "@/lib/landing-plans";
import { JsonLd, SITE_URL, breadcrumbLd, faqPageLd } from "@/lib/seo";

export function generateStaticParams() {
  return FEATURES.map((f) => ({ slug: f.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const feature = getFeature(slug);
  if (!feature) return {};
  return {
    title: feature.metaTitle,
    description: feature.metaDescription,
    alternates: { canonical: `/features/${feature.slug}` },
    openGraph: {
      type: "website",
      title: feature.metaTitle,
      description: feature.metaDescription,
      url: `/features/${feature.slug}`,
    },
    twitter: {
      card: "summary_large_image",
      title: feature.metaTitle,
      description: feature.metaDescription,
    },
  };
}

/**
 * /features/[slug] — one sub-landing page per feature, after rankbox.xyz's, drawn in
 * the homepage's frame (framed nav and footer, hairline rails). The copy is the
 * feature's entry in lib/features.ts; the layout is components/features. The FAQPage
 * JSON-LD mirrors the visible FAQ (same items).
 */
export default async function FeatureRoute({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const feature = getFeature(slug);
  if (!feature) notFound();

  const url = `${SITE_URL}/features/${feature.slug}`;

  return (
    <div className={`landing ${landingFont.variable} relative min-h-screen w-full overflow-x-clip bg-white`}>
      <JsonLd
        data={[
          breadcrumbLd([
            { name: "Home", url: SITE_URL },
            { name: "Features", url: `${SITE_URL}/features` },
            { name: feature.name, url },
          ]),
          faqPageLd(feature.faqs),
        ]}
      />
      <LandingNav framed />
      <main>
        <FeaturePage feature={feature} plans={getLandingPlans()} />
      </main>
      <LandingFooter framed />
    </div>
  );
}
