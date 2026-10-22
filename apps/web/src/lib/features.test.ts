import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ENGINE_ORDER, FEATURES, getFeature } from "./features";
import { getAllPosts } from "./blog";
import { GLOSSARY_TERMS } from "./glossary";
import { LIVE_TOOLS } from "./tools/registry";

const APP = join(__dirname, "..", "app");

/** True when an internal path is served by a route in src/app. */
function routeExists(href: string): boolean {
  const path = href.split("#")[0].replace(/\/$/, "");
  const [, section, slug] = path.split("/");
  if (slug !== undefined) {
    if (section === "features") return getFeature(slug) !== undefined;
    // /tools/[slug] 404s a tool that isn't live, so only live tools count.
    if (section === "tools") return LIVE_TOOLS.some((t) => t.slug === slug);
    if (section === "glossary") return GLOSSARY_TERMS.some((g) => g.slug === slug);
    if (section === "blog") return getAllPosts().some((p) => p.slug === slug);
  }
  return existsSync(join(APP, path, "page.tsx"));
}

const allCopy = FEATURES.map((f) => JSON.stringify(f)).join(" ");
/* Everything a page asserts: all copy except FAQ questions, which may ask about
   approval in order to answer it. */
const claims = FEATURES.map((f) =>
  JSON.stringify({ ...f, faqs: f.faqs.map((q) => q.a) }),
).join(" ");

describe("FEATURES", () => {
  it("lists every feature once, in the engine order", () => {
    expect(FEATURES.map((f) => f.slug).sort()).toEqual([...ENGINE_ORDER].sort());
    expect(new Set(FEATURES.map((f) => f.slug)).size).toBe(FEATURES.length);
  });

  it("gives every page the full layout's content", () => {
    for (const f of FEATURES) {
      expect(f.specs, f.slug).toHaveLength(4);
      expect(f.benefits, f.slug).toHaveLength(3);
      expect(f.steps, f.slug).toHaveLength(3);
      expect(f.faqs.length, f.slug).toBeGreaterThanOrEqual(4);
      expect(f.problem.before, f.slug).toHaveLength(4);
      expect(f.problem.after, f.slug).toHaveLength(4);
    }
  });

  it("keeps each half of the headline short enough for the lockup", () => {
    for (const f of FEATURES) {
      expect(f.headline.lead.length, f.slug).toBeLessThanOrEqual(21);
      expect(f.headline.accent.length, f.slug).toBeLessThanOrEqual(20);
    }
  });

  it("links only to routes that exist", () => {
    for (const f of FEATURES) {
      for (const href of [...f.explore.links.map((l) => l.href), ...f.explore.terms.map((t) => t.href)]) {
        expect(routeExists(href), `${f.slug} → ${href}`).toBe(true);
      }
    }
  });

  it("speaks autopilot, never per-message approval", () => {
    expect(claims).not.toMatch(/you approve|approve (each|every) (send|message)|nothing sends unread/i);
  });

  it("never names a white-labeled vendor", () => {
    expect(allCopy).not.toMatch(/unipile|smartlead|explorium|\bclay\b/i);
  });

  it("names only CRMs Vantera connects to (packages/crm-infra rejects Pipedrive)", () => {
    expect(allCopy).not.toMatch(/pipedrive/i);
  });
});
