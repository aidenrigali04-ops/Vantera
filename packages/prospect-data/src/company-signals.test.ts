import { describe, expect, it } from "vitest";
import { classifyCompanyEvent, companyKey, InMemoryCompanySignals } from "./company-signals";

describe("companyKey", () => {
  it("prefers domain, lowercased; falls back to name", () => {
    expect(companyKey({ name: "Acme Co", domain: "Acme.com" })).toBe("acme.com");
    expect(companyKey({ name: "Acme Co" })).toBe("acme co");
  });
});

describe("classifyCompanyEvent", () => {
  it("maps headlines to the right signal kind", () => {
    expect(classifyCompanyEvent("Acme raises $20M Series B")).toBe("funding");
    expect(classifyCompanyEvent("Acme acquires Beta in merger")).toBe("m_and_a");
    expect(classifyCompanyEvent("Acme appoints new VP of Sales")).toBe("exec_hire");
    expect(classifyCompanyEvent("Acme launches new platform")).toBe("product_launch");
    expect(classifyCompanyEvent("Acme partners with Globex")).toBe("partnership");
    expect(classifyCompanyEvent("Acme opens a London office")).toBe("office_opening");
  });
  it("returns null for unmatched / noise", () => {
    expect(classifyCompanyEvent("Acme releases quarterly blog post")).toBeNull();
    expect(classifyCompanyEvent("")).toBeNull();
  });
});

describe("InMemoryCompanySignals", () => {
  it("returns seeded signals by companyKey and empty for unknown", async () => {
    const seed = new Map([
      ["acme.com", [{ kind: "funding", detail: "raised Series B", observedAt: "2026-06-20" }]],
    ]);
    const src = new InMemoryCompanySignals(seed);
    const out = await src.getCompanySignals([{ name: "Acme", domain: "acme.com" }, { name: "Nope" }]);
    expect(out.get("acme.com")?.[0]?.kind).toBe("funding");
    expect(out.get("nope")).toBeUndefined();
  });
});
