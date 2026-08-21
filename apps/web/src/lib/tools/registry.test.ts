import { describe, expect, it } from "vitest";
import { TOOLS, LIVE_TOOLS, TOOL_CATEGORIES, type ToolOutput } from "./registry";
import { TOOL_PROMPTS } from "./prompts";
import { OUTPUT_SCHEMAS } from "./schemas";

const VALID_OUTPUTS: ToolOutput[] = ["variants", "boolean", "score", "roast"];

// Vendors that must never appear on a user-facing surface (white-label, rules 03–05).
const VENDOR_NAMES = ["smartlead", "unipile", "explorium", "clay", "waalaxy", "goji"];

describe("tools registry", () => {
  it("has unique slugs", () => {
    const slugs = TOOLS.map((t) => t.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("every slug is url-safe kebab-case", () => {
    for (const t of TOOLS) {
      // linear-time checks (avoids a ReDoS-prone nested-quantifier regex)
      expect(t.slug).toMatch(/^[a-z0-9-]+$/);
      expect(t.slug.startsWith("-")).toBe(false);
      expect(t.slug.endsWith("-")).toBe(false);
      expect(t.slug.includes("--")).toBe(false);
    }
  });

  it("every live tool declares a valid output mode with a matching schema", () => {
    for (const t of LIVE_TOOLS) {
      expect(VALID_OUTPUTS).toContain(t.output);
      expect(OUTPUT_SCHEMAS[t.output]).toBeDefined();
    }
  });

  it("every live tool has at least one field and a required field", () => {
    for (const t of LIVE_TOOLS) {
      expect(t.fields.length).toBeGreaterThan(0);
      expect(t.fields.some((f) => f.required)).toBe(true);
    }
  });

  it("every field has a positive maxLength and select fields declare options", () => {
    for (const t of TOOLS) {
      for (const f of t.fields) {
        expect(f.maxLength).toBeGreaterThan(0);
        if (f.type === "select") {
          expect(f.options?.length ?? 0).toBeGreaterThan(0);
        }
      }
    }
  });

  it("every live tool has a server prompt; coming-soon tools do not need one", () => {
    for (const t of LIVE_TOOLS) {
      expect(TOOL_PROMPTS[t.slug], `missing prompt for ${t.slug}`).toBeTruthy();
    }
  });

  it("prompt keys all map to a known tool", () => {
    const slugs = new Set(TOOLS.map((t) => t.slug));
    for (const key of Object.keys(TOOL_PROMPTS)) {
      expect(slugs.has(key)).toBe(true);
    }
  });

  it("every live tool ships SEO metadata and at least one FAQ", () => {
    for (const t of LIVE_TOOLS) {
      expect(t.metaTitle.length).toBeGreaterThan(10);
      expect(t.metaDescription.length).toBeGreaterThan(30);
      expect(t.keywords.length).toBeGreaterThan(0);
      expect(t.faqs.length).toBeGreaterThan(0);
      for (const f of t.faqs) {
        expect(f.q.length).toBeGreaterThan(0);
        expect(f.a.length).toBeGreaterThan(0);
      }
    }
  });

  it("related links only reference real tools", () => {
    const slugs = new Set(TOOLS.map((t) => t.slug));
    for (const t of TOOLS) {
      for (const rel of t.related) {
        expect(slugs.has(rel), `${t.slug} → ${rel}`).toBe(true);
      }
    }
  });

  it("every tool category is a declared category", () => {
    for (const t of TOOLS) {
      expect(TOOL_CATEGORIES).toContain(t.category);
    }
  });

  it("leaks no white-labeled vendor names in any user-facing copy", () => {
    const surface = TOOLS.map((t) =>
      [
        t.name,
        t.tagline,
        t.metaTitle,
        t.metaDescription,
        t.keywords.join(" "),
        t.faqs.map((f) => `${f.q} ${f.a}`).join(" "),
        t.fields.map((f) => `${f.label} ${f.placeholder ?? ""} ${f.hint ?? ""}`).join(" "),
      ].join(" "),
    );
    const promptText = Object.values(TOOL_PROMPTS).join(" ");
    const haystack = [...surface, promptText].join(" ").toLowerCase();
    for (const vendor of VENDOR_NAMES) {
      expect(haystack.includes(vendor), `vendor name leaked: ${vendor}`).toBe(false);
    }
  });
});
