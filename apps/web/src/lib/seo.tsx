import type { FaqItem } from "@/components/landing/faq-data";
import type { BlogPost } from "@/lib/blog";

/** Single source for the production origin (also drives metadataBase, robots, sitemap). */
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://vanterasystem.dev";

/** The site's canonical description — reused by metadata AND structured data so they never drift. */
export const SITE_DESCRIPTION =
  "Vantera is an adaptive prospecting system for LinkedIn lead gen — a self-optimizing engine that tracks prospect intent and action, builds qualified campaign pipelines from your target audience, and gets smarter with every reply. You approve every send. Start free.";

/** Renders a JSON-LD <script>. Accepts one object or an array of schema.org objects. */
export function JsonLd({ data }: { data: object | object[] }) {
  return (
    <script
      type="application/ld+json"
      // schema is our own static, trusted content — safe to inline
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

/** Organization — how Google AND LLMs resolve "Vantera" as an entity. */
export function organizationLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Vantera",
    url: SITE_URL,
    logo: `${SITE_URL}/icon.svg`,
    description: SITE_DESCRIPTION,
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "sales",
      email: "sales@vanterasystem.com",
    },
    // TODO: add `sameAs: [linkedinUrl, xUrl, crunchbaseUrl]` once social/listing profiles exist —
    // sameAs is the strongest off-page entity signal for both Google and AI engines.
  };
}

/** WebSite — names the site entity. (No SearchAction: there's no public site-search endpoint.) */
export function websiteLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Vantera",
    url: SITE_URL,
    publisher: { "@type": "Organization", name: "Vantera" },
  };
}

/** SoftwareApplication with real plan offers — entity clarity + price surface (no faked ratings). */
export function softwareApplicationLd(plans: { name: string; monthlyUsd: number }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Vantera",
    applicationCategory: "BusinessApplication",
    applicationSubCategory: "Sales Engagement / LinkedIn Automation",
    operatingSystem: "Web",
    url: SITE_URL,
    description: SITE_DESCRIPTION,
    offers: plans.map((p) => ({
      "@type": "Offer",
      name: p.name,
      price: String(p.monthlyUsd),
      priceCurrency: "USD",
      priceSpecification: {
        "@type": "UnitPriceSpecification",
        price: String(p.monthlyUsd),
        priceCurrency: "USD",
        billingDuration: 1,
        unitCode: "MON",
      },
    })),
  };
}

/** FAQPage — answer-shaped content for AI Overviews / LLM extraction. Text matches the visible FAQ. */
export function faqPageLd(items: FaqItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };
}

/** Article — the citable unit for blog posts (Google Discover/news + LLM source attribution). */
export function articleLd(post: BlogPost, url: string) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.description,
    datePublished: post.date,
    dateModified: post.updated ?? post.date,
    author: { "@type": "Organization", name: "Vantera", url: SITE_URL },
    publisher: {
      "@type": "Organization",
      name: "Vantera",
      logo: { "@type": "ImageObject", url: `${SITE_URL}/icon.svg` },
    },
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    image: `${SITE_URL}/opengraph-image`,
    keywords: post.keywords.join(", "),
  };
}

/** BreadcrumbList — the page's place in the site so engines render a breadcrumb trail. */
export function breadcrumbLd(items: { name: string; url: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: it.url,
    })),
  };
}
