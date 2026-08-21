import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";
import { getAllPosts } from "@/lib/blog";
import { USE_CASES } from "@/components/landing/use-case/registry";
import { getAllTerms } from "@/lib/glossary";
import { LIVE_TOOLS } from "@/lib/tools/registry";

/** Indexable marketing pages + blog (the authed app is disallowed in robots.ts). */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const staticPages: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/pricing`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/use-cases`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${SITE_URL}/glossary`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { url: `${SITE_URL}/tools`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { url: `${SITE_URL}/blog`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { url: `${SITE_URL}/faq`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE_URL}/safety`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE_URL}/ai-info`, lastModified: now, changeFrequency: "monthly", priority: 0.4 },
    { url: `${SITE_URL}/about`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE_URL}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ];
  // Live use-case pages (persona landing pages ship one at a time via the registry).
  const useCases: MetadataRoute.Sitemap = USE_CASES.filter((u) => u.live).map((u) => ({
    url: `${SITE_URL}/use-cases/${u.slug}`,
    lastModified: now,
    changeFrequency: "monthly",
    priority: 0.8,
  }));
  const posts: MetadataRoute.Sitemap = getAllPosts().map((p) => ({
    url: `${SITE_URL}/blog/${p.slug}`,
    lastModified: new Date(`${p.updated ?? p.date}T00:00:00Z`),
    changeFrequency: "monthly",
    priority: 0.6,
  }));
  // Glossary hub + per-term pages (topic-cluster hub-and-spoke).
  const glossary: MetadataRoute.Sitemap = getAllTerms().map((t) => ({
    url: `${SITE_URL}/glossary/${t.slug}`,
    lastModified: new Date(`${t.updated}T00:00:00Z`),
    changeFrequency: "monthly",
    priority: 0.6,
  }));
  // Free LinkedIn tools — one indexable page per live tool (registry-driven).
  const tools: MetadataRoute.Sitemap = LIVE_TOOLS.map((t) => ({
    url: `${SITE_URL}/tools/${t.slug}`,
    lastModified: now,
    changeFrequency: "monthly",
    priority: 0.6,
  }));
  return [...staticPages, ...useCases, ...glossary, ...tools, ...posts];
}
