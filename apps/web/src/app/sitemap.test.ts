import { describe, expect, it } from "vitest";
import sitemap from "./sitemap";
import { FEATURES } from "@/lib/features";
import { SITE_URL } from "@/lib/seo";

describe("sitemap", () => {
  const urls = sitemap().map((e) => e.url);

  it("lists the features index and every feature page", () => {
    expect(urls).toContain(`${SITE_URL}/features`);
    for (const f of FEATURES) expect(urls, f.slug).toContain(`${SITE_URL}/features/${f.slug}`);
  });

  it("lists each url once", () => {
    expect(new Set(urls).size).toBe(urls.length);
  });
});
