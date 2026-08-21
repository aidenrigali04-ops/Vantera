import type { Metadata } from "next";
import { MarketingShell } from "@/components/landing/marketing-shell";
import { LandingHeading } from "@/components/landing/heading";
import { FaqAccordion } from "@/app/faq/faq-accordion";
import { GlossaryHub } from "@/components/glossary/glossary-hub";
import { FeaturedResources } from "@/components/glossary/featured-resources";
import { GlossaryCta } from "@/components/glossary/glossary-cta";
import { JsonLd, breadcrumbLd, faqPageLd, SITE_URL } from "@/lib/seo";
import {
  GLOSSARY_CATEGORIES,
  getAllTerms,
  getRecentTerms,
  getTrendingTerms,
} from "@/lib/glossary";

const PAGE_URL = `${SITE_URL}/glossary`;

export const metadata: Metadata = {
  title: "Resources & Glossary — LinkedIn, Sales, SEO & AI Search Terms | Vantera",
  description:
    "The definitive glossary for modern growth teams: clear, citable definitions for LinkedIn, sales, cold outreach, SEO, AEO, GEO, and AI search — searchable, categorized, and updated regularly.",
  alternates: { canonical: "/glossary" },
  openGraph: {
    title: "Resources & Glossary — The language of modern growth | Vantera",
    description:
      "Clear, citable definitions for LinkedIn, sales, cold outreach, SEO, and AI search — the terms modern growth teams actually use.",
    url: PAGE_URL,
    type: "website",
  },
};

const HUB_FAQ = [
  {
    q: "What is the Vantera glossary?",
    a: "It's a free, curated glossary of the terms modern growth teams use across LinkedIn, sales, cold outreach, SEO, and AI search. Each entry gives a clear, citable definition, why it matters, and links to related concepts so you can learn a topic, not just a word.",
  },
  {
    q: "What's the difference between SEO, AEO, and GEO?",
    a: "SEO earns rankings in traditional search results. AEO (Answer Engine Optimization) earns the cited answer in features like Google's AI Overviews, featured snippets, and voice. GEO (Generative Engine Optimization) earns presence and citations inside generative AI engines like ChatGPT, Perplexity, and Gemini. They share signals — authority, structure, and clear entities — but optimize for different surfaces.",
  },
  {
    q: "How often is the glossary updated?",
    a: "Entries are reviewed and expanded regularly, with new terms and categories added as the space evolves. Every term shows the date it was last reviewed.",
  },
  {
    q: "Is it free to use?",
    a: "Yes. Every definition and resource is free to read and share — no signup required.",
  },
];

function websiteSearchLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Vantera",
    url: SITE_URL,
    potentialAction: {
      "@type": "SearchAction",
      target: { "@type": "EntryPoint", urlTemplate: `${PAGE_URL}?q={search_term_string}` },
      "query-input": "required name=search_term_string",
    },
  };
}

function collectionLd() {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Resources & Glossary",
    description: metadata.description,
    url: PAGE_URL,
    isPartOf: { "@type": "WebSite", name: "Vantera", url: SITE_URL },
    about: GLOSSARY_CATEGORIES.map((c) => ({ "@type": "Thing", name: c.label })),
  };
}

function definedTermSetLd() {
  return {
    "@context": "https://schema.org",
    "@type": "DefinedTermSet",
    name: "Vantera Glossary",
    url: PAGE_URL,
    hasDefinedTerm: getAllTerms().map((t) => ({
      "@type": "DefinedTerm",
      name: t.term,
      description: t.summary,
      url: `${PAGE_URL}/${t.slug}`,
    })),
  };
}

function itemListLd() {
  const terms = getAllTerms();
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Glossary terms",
    numberOfItems: terms.length,
    itemListElement: terms.map((t, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `${PAGE_URL}/${t.slug}`,
      name: t.term,
    })),
  };
}

export default function GlossaryHubPage() {
  const terms = getAllTerms();
  const trending = getTrendingTerms(6);
  const recent = getRecentTerms(6);
  const popular = ["AEO", "GEO", "Cold Email", "MEDDIC", "Deliverability", "Social Selling"];

  return (
    <MarketingShell>
      <JsonLd
        data={[
          breadcrumbLd([
            { name: "Home", url: SITE_URL },
            { name: "Glossary", url: PAGE_URL },
          ]),
          websiteSearchLd(),
          collectionLd(),
          definedTermSetLd(),
          itemListLd(),
          faqPageLd(HUB_FAQ),
        ]}
      />

      <GlossaryHub
        terms={terms}
        trending={trending}
        recent={recent}
        popular={popular}
        stats={{ terms: terms.length, categories: GLOSSARY_CATEGORIES.length }}
      />

      <FeaturedResources />

      {/* Hub FAQ — visible text matches the FAQPage JSON-LD above (Google requirement). */}
      <section className="relative border-t border-[var(--hairline)] bg-[var(--tint)] py-20 sm:py-24">
        <div className="mx-auto max-w-3xl px-6 lg:px-8">
          <LandingHeading
            eyebrow="FAQ"
            title="About the glossary"
            subtitle="What this is, how it's maintained, and how the modern-search acronyms fit together."
          />
          <div className="mt-10">
            <FaqAccordion items={HUB_FAQ} />
          </div>
        </div>
      </section>

      <GlossaryCta />
    </MarketingShell>
  );
}
