import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

/** Indexable marketing pages only (the authed app is disallowed in robots.ts). */
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return [
    { url: `${SITE_URL}/`, lastModified, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/pricing`, lastModified, changeFrequency: "monthly", priority: 0.8 },
  ];
}
