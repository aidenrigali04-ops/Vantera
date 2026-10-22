import { describe, expect, it } from "vitest";
import { makeCandidate } from "@vantera/prospect-data";
import { applyRulesGate } from "./rules-gate";

describe("applyRulesGate", () => {
  const candidate = makeCandidate({
    industry: "SaaS",
    companySize: "11-50",
    title: "CTO & Co-founder",
    location: "United States",
  });

  it("passes when every present criterion matches (case-insensitive)", () => {
    const result = applyRulesGate(candidate, {
      industries: ["saas"],
      companySizes: ["11-50"],
      titles: ["cto"],
      geos: ["united states"],
    });
    expect(result).toEqual({ passed: true, reasons: [] });
  });

  it("passes everything through when criteria are empty", () => {
    expect(applyRulesGate(candidate, {}).passed).toBe(true);
  });

  it("fails with a reason naming the mismatched criterion", () => {
    const result = applyRulesGate(candidate, { industries: ["logistics"] });
    expect(result.passed).toBe(false);
    expect(result.reasons[0]).toContain("industry");
    expect(result.reasons[0]).toContain("logistics");
  });

  it("defers (passes) when the candidate is missing a field criteria asks for", () => {
    // Discovery responses don't carry company_size/company_industry — only title,
    // seniority, and geo. A field the provider didn't return at discovery must not
    // hard-reject; size/industry filtering happens at the discovery query + AI rank.
    const result = applyRulesGate(makeCandidate({ industry: undefined }), {
      industries: ["saas"],
    });
    expect(result).toEqual({ passed: true, reasons: [] });
  });

  it("still rejects a positive mismatch on a field the candidate does have", () => {
    const result = applyRulesGate(makeCandidate({ industry: "Logistics" }), {
      industries: ["saas"],
    });
    expect(result.passed).toBe(false);
    expect(result.reasons[0]).toContain("industry");
  });

  it("collects every failed criterion, not just the first", () => {
    const result = applyRulesGate(candidate, {
      industries: ["logistics"],
      geos: ["germany"],
    });
    expect(result.reasons).toHaveLength(2);
  });

  it("checks seniority terms against the title", () => {
    expect(applyRulesGate(candidate, { seniorities: ["founder"] }).passed).toBe(true);
    expect(applyRulesGate(candidate, { seniorities: ["intern"] }).passed).toBe(false);
  });

  it("matches terms at a word start, not mid-word", () => {
    // "director" contains "cto", "Austin" contains "us", "Hospitality" contains "it" — none are matches.
    expect(applyRulesGate(makeCandidate({ title: "Director of Sales" }), { titles: ["cto"] }).passed).toBe(false);
    expect(applyRulesGate(makeCandidate({ location: "Austin, Texas" }), { geos: ["us"] }).passed).toBe(false);
    expect(applyRulesGate(makeCandidate({ industry: "Hospitality" }), { industries: ["it"] }).passed).toBe(false);
  });

  it("still matches word-start terms, suffixes, and punctuated values", () => {
    expect(applyRulesGate(makeCandidate({ industry: "IT Services" }), { industries: ["it"] }).passed).toBe(true);
    expect(applyRulesGate(makeCandidate({ title: "Head of Engineering" }), { titles: ["engineer"] }).passed).toBe(true);
    expect(applyRulesGate(makeCandidate({ title: "Co-Founder/CEO" }), { seniorities: ["ceo"] }).passed).toBe(true);
    expect(applyRulesGate(makeCandidate({ companySize: "201-500" }), { companySizes: ["201-500"] }).passed).toBe(true);
    expect(applyRulesGate(makeCandidate({ title: "VP, R&D (US)" }), { titles: ["r&d"] }).passed).toBe(true);
  });

  it("rejects job seekers regardless of ICP — someone looking for work is not a buyer", () => {
    for (const title of [
      "Open to Work | Former VP Sales",
      "#OpenToWork — RevOps leader",
      "Seeking new opportunities in SaaS sales",
      "Ex-CTO, looking for a new role",
      "Actively looking for my next opportunity",
      "Marketing Director (in transition)",
    ]) {
      const r = applyRulesGate(makeCandidate({ title }), {});
      expect(r.passed, title).toBe(false);
      expect(r.reasons[0]).toContain("job seeker");
    }
  });

  it("does not mistake buyers for job seekers", () => {
    for (const title of [
      "VP Sales — we're hiring SDRs",
      "Founder, open source workflow tools",
      "Head of Talent, looking for great engineers",
      "CTO | building the work OS",
    ]) {
      expect(applyRulesGate(makeCandidate({ title }), {}).passed, title).toBe(true);
    }
  });
});


describe("applyRulesGate — title matching (prod rejections, 2026-10-22)", () => {
  // The account's real ICP titles; each case below was wrongly rejected in production.
  const icp = {
    titles: ["Founder", "CEO", "Co-Founder", "Sales Director", "VP of Sales", "Head of Business Development"],
  };
  const gate = (title: string) => applyRulesGate(makeCandidate({ title }), icp).passed;

  it("matches an abbreviation against its spelled-out title", () => {
    expect(gate("Chief Executive Officer")).toBe(true);
    expect(gate("Chief Executive Officer (CEO)")).toBe(true);
  });

  it("matches the same words in a different order", () => {
    expect(gate("Director of Sales And Business Development")).toBe(true);
    expect(gate("Sales and Marketing Director, member of leadership team")).toBe(true);
    expect(gate("Director of Sales Marketing")).toBe(true);
  });

  it("expands Vice President to VP", () => {
    expect(gate("Vice President of Sales")).toBe(true);
    expect(gate("Vice President of Sales at LTS Health, Public Sector and Higher Education")).toBe(true);
  });

  it("treats the top-executive titles used outside the US as CEO-level", () => {
    expect(gate("Managing Director")).toBe(true);
    expect(gate("Owner")).toBe(true);
    expect(gate("President")).toBe(true);
    expect(gate("Board Director")).toBe(false);
  });

  it("treats leadership levels of the same function as equivalent", () => {
    expect(gate("Vice President, Business Development & Alliances")).toBe(true);
    expect(gate("SVP Sales")).toBe(true);
    expect(gate("Head of Sales")).toBe(true);
  });

  it("still matches founder variants", () => {
    expect(gate("CTO & Co-founder")).toBe(true);
    expect(gate("Cofounder")).toBe(true);
  });

  it("still rejects a different function or a non-leadership role", () => {
    expect(gate("Software Architect & Forensics Lead")).toBe(false);
    expect(gate("Sr. Digital Marketing Manager")).toBe(false);
    expect(gate("Sales Manager - Customer Success Evangelist")).toBe(false);
    expect(gate("Business Development Executive")).toBe(false);
  });

  it("keeps word-start matching: 'cto' never matches inside 'director'", () => {
    expect(applyRulesGate(makeCandidate({ title: "Director of Ops" }), { titles: ["cto"] }).passed).toBe(false);
  });
});
