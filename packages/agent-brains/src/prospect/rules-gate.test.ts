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

  it("fails closed when the candidate is missing a required field", () => {
    const result = applyRulesGate(makeCandidate({ industry: undefined }), {
      industries: ["saas"],
    });
    expect(result.passed).toBe(false);
    expect(result.reasons).toEqual(["missing industry"]);
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
});
