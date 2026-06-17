import { describe, expect, it } from "vitest";
import { brandToken, brandedSendingDomains, primaryHost } from "./branded-domains";

describe("brandToken", () => {
  it("derives the brand from a website URL (strips protocol, www, path, TLD)", () => {
    expect(brandToken(null, "https://www.acme.com/pricing")).toBe("acme");
    expect(brandToken(null, "acme.io")).toBe("acme");
    expect(brandToken(null, "https://acme.co.uk")).toBe("acme");
  });

  it("falls back to the company name and strips legal suffixes", () => {
    expect(brandToken("Acme Corp", null)).toBe("acme");
    expect(brandToken("Acme Labs, Inc.", null)).toBe("acme");
    expect(brandToken("Northwind Trading LLC", null)).toBe("northwindtrading");
  });

  it("prefers the website root over the company name", () => {
    expect(brandToken("Some Long Legal Name", "https://acme.com")).toBe("acme");
  });

  it("returns null when there's no usable brand", () => {
    expect(brandToken(null, null)).toBeNull();
    expect(brandToken("", "")).toBeNull();
    expect(brandToken("a", null)).toBeNull(); // too short
  });
});

describe("brandedSendingDomains", () => {
  it("produces recognizable look-alike candidates, never the primary domain", () => {
    const out = brandedSendingDomains("Acme Inc", "https://www.acme.com", 2);
    expect(out.length).toBeGreaterThanOrEqual(2);
    // recognizable as Acme
    expect(out.some((d) => d.includes("acme"))).toBe(true);
    // never the primary corporate domain (the whole point — protect their real reputation)
    expect(out).not.toContain("acme.com");
  });

  it("returns only valid, lowercased, deduped domains", () => {
    const out = brandedSendingDomains("Acme", "https://acme.com", 5);
    expect(new Set(out).size).toBe(out.length);
    for (const d of out) {
      expect(d).toBe(d.toLowerCase());
      expect(d).toMatch(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/);
    }
  });

  it("returns an empty list when there's no brand to work from (caller falls back)", () => {
    expect(brandedSendingDomains(null, null, 2)).toEqual([]);
  });
});

describe("primaryHost", () => {
  it("extracts the registrable host to exclude", () => {
    expect(primaryHost("https://www.acme.com/x")).toBe("acme.com");
    expect(primaryHost("acme.io")).toBe("acme.io");
    expect(primaryHost(null)).toBeNull();
  });
});
