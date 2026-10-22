import { describe, expect, it } from "vitest";
import { makeCandidate } from "@vantera/prospect-data";
import { applyExclusions, normalizeTargetingRules, EMPTY_TARGETING } from "./exclusions";

const rules = (over: Partial<ReturnType<typeof normalizeTargetingRules>> = {}) => ({ ...EMPTY_TARGETING, ...over });

describe("normalizeTargetingRules", () => {
  it("parses stored config defensively, trims, dedupes, and caps", () => {
    const r = normalizeTargetingRules({
      excludeAgencies: true,
      competitors: [" Acme ", "acme", "", 7, "x".repeat(200)],
      keywords: Array.from({ length: 80 }, (_, i) => `k${i}`),
      guidance: "  Prioritize B2B SaaS founders; avoid agencies.  ",
    });
    expect(r.excludeAgencies).toBe(true);
    expect(r.excludeFreelancers).toBe(false);
    expect(r.competitors).toEqual(["Acme"]);
    expect(r.keywords).toHaveLength(50);
    expect(r.guidance).toBe("Prioritize B2B SaaS founders; avoid agencies.");
  });

  it("returns empty rules for missing or malformed config", () => {
    expect(normalizeTargetingRules(undefined)).toEqual(EMPTY_TARGETING);
    expect(normalizeTargetingRules("nope")).toEqual(EMPTY_TARGETING);
    expect(normalizeTargetingRules({ guidance: 42 }).guidance).toBeNull();
  });
});

describe("applyExclusions", () => {
  it("excludes nothing with empty rules", () => {
    expect(applyExclusions(makeCandidate({ title: "Agency Owner", companyName: "Growth Agency" }), EMPTY_TARGETING)).toBeNull();
  });

  it("excludes agencies and consultants when asked", () => {
    const r = rules({ excludeAgencies: true });
    expect(applyExclusions(makeCandidate({ title: "Founder", companyName: "Bright Digital Agency" }), r)).toContain("agency");
    expect(applyExclusions(makeCandidate({ title: "Independent Sales Consultant", companyName: "Self" }), r)).toContain("agency");
    expect(applyExclusions(makeCandidate({ title: "VP Sales", companyName: "Acme Software" }), r)).toBeNull();
  });

  it("excludes freelancers when asked", () => {
    const r = rules({ excludeFreelancers: true });
    expect(applyExclusions(makeCandidate({ title: "Freelance copywriter" }), r)).toContain("freelancer");
    expect(applyExclusions(makeCandidate({ title: "Self-employed designer" }), r)).toContain("freelancer");
    expect(applyExclusions(makeCandidate({ title: "Head of Design" }), r)).toBeNull();
  });

  it("matches company lists by normalized name or domain, never by a loose substring", () => {
    const r = rules({ competitors: ["Acme, Inc."], customers: ["globex.com"], companies: ["Initech"] });
    expect(applyExclusions(makeCandidate({ companyName: "ACME" }), r)).toContain("competitor");
    expect(applyExclusions(makeCandidate({ companyName: "Acme Labs LLC" }), r)).toContain("competitor");
    expect(applyExclusions(makeCandidate({ companyName: "Globex Corp", companyDomain: "globex.com" }), r)).toContain("existing customer");
    expect(applyExclusions(makeCandidate({ companyName: "Initech" }), r)).toContain("excluded company");
    expect(applyExclusions(makeCandidate({ companyName: "Acmeworks" }), r)).toBeNull(); // not Acme
  });

  it("matches keywords at a word start in title, company, or industry", () => {
    const r = rules({ keywords: ["crypto", "recruit"] });
    expect(applyExclusions(makeCandidate({ title: "Crypto fund partner" }), r)).toContain("crypto");
    expect(applyExclusions(makeCandidate({ title: "Head of Recruiting" }), r)).toContain("recruit");
    expect(applyExclusions(makeCandidate({ title: "Democratic organizer" }), r)).toBeNull(); // "crat" ≠ "crypto"
  });
});
