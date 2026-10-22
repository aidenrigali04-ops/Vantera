import type { Metadata } from "next";
import { MarketingShell } from "@/components/landing/marketing-shell";
import { Band, Spacer } from "@/components/landing/frame";
import { FinalCta } from "@/components/landing/final-cta";
import { Reveal, RevealItem } from "@/components/landing/surface";
import { BlogHero } from "@/components/blog/blog-hero";
import { BlogLibrary } from "@/components/blog/blog-library";
import { FeaturedPost, toPostMeta } from "@/components/blog/post-cards";
import { ToolsBand } from "@/components/blog/tools-band";
import { getAllPosts } from "@/lib/blog";
import { JsonLd, SITE_URL } from "@/lib/seo";

const DESCRIPTION =
  "Quality-first LinkedIn outreach: account safety, buying-intent signals, and the playbooks behind pipeline that actually converts.";

export const metadata: Metadata = {
  title: "LinkedIn Outreach Playbook — Vantera Blog",
  description: DESCRIPTION,
  alternates: { canonical: "/blog" },
};

/**
 * /blog, after rankbox.xyz's blog: the framed hero, the lead story in a band of its own,
 * the library (search, topics, the hairline grid), free tools for the steps the guides
 * walk through, and the landing's closing band.
 */
export default function BlogIndex() {
  const posts = getAllPosts();
  const lead = posts.find((p) => p.featured) ?? posts[0];
  const url = `${SITE_URL}/blog`;

  return (
    <MarketingShell framed>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Blog",
          name: "Vantera Blog",
          description: DESCRIPTION,
          url,
          publisher: { "@type": "Organization", name: "Vantera", url: SITE_URL },
          blogPost: posts.map((p) => ({
            "@type": "BlogPosting",
            headline: p.title,
            url: `${url}/${p.slug}`,
            datePublished: p.date,
            dateModified: p.updated ?? p.date,
            description: p.description,
          })),
        }}
      />
      <BlogHero />

      {lead && (
        <section aria-label="Featured article">
          <Band>
            <Reveal>
              <RevealItem>
                <FeaturedPost post={toPostMeta(lead)} />
              </RevealItem>
            </Reveal>
          </Band>
        </section>
      )}

      <BlogLibrary posts={posts.map(toPostMeta)} featuredSlug={lead?.slug} />
      <ToolsBand />
      <Spacer />
      <FinalCta />
    </MarketingShell>
  );
}
