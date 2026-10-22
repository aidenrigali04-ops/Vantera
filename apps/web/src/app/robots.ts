import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

/**
 * AI crawlers (GPTBot, ClaudeBot, PerplexityBot, Google-Extended, etc.) fall under "*" and are
 * intentionally ALLOWED — AEO/LLM visibility depends on them reading the public site. Only the
 * authenticated app + API are disallowed.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/dashboard",
        "/prospects",
        "/playbook",
        "/analytics",
        "/campaigns",
        "/pipeline",
        "/approvals",
        "/sequence",
        "/settings",
        "/onboarding",
        "/invite",
        "/auth",
        "/api",
        // Login walls. They 307 to /login, which Google records as a page it could not index.
        "/today",
        "/inbox",
        "/meetings",
        "/learning",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
