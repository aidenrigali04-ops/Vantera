import { describe, expect, it } from "vitest";
import { titleMatches } from "./title-match";

describe("titleMatches", () => {
  it("expands abbreviations on both sides", () => {
    expect(titleMatches("Chief Revenue Officer", "CRO")).toBe(true);
    expect(titleMatches("VP, BD", "Head of Business Development")).toBe(true);
    expect(titleMatches("Sr. Director of Sales", "Sales Director")).toBe(true);
  });

  it("ignores word order and stopwords", () => {
    expect(titleMatches("Director, Sales & Business Development", "Sales Director")).toBe(true);
  });

  it("requires every function word", () => {
    expect(titleMatches("Director of Marketing", "Sales Director")).toBe(false);
  });

  it("requires a leadership level when the wanted title names one", () => {
    expect(titleMatches("Sales Associate", "VP of Sales")).toBe(false);
    expect(titleMatches("Sales Associate", "Sales")).toBe(true);
  });

  it("treats a bare level as a seniority filter", () => {
    expect(titleMatches("Head of CX", "VP")).toBe(false);
    expect(titleMatches("SVP Customer Success", "VP")).toBe(true);
    expect(titleMatches("Director of Ops", "Director")).toBe(true);
  });

  it("matches at word starts only", () => {
    expect(titleMatches("Engineering Manager", "engineer")).toBe(true);
    expect(titleMatches("Director of Ops", "cto")).toBe(false);
  });

  it("never matches an empty wanted title", () => {
    expect(titleMatches("CEO", "  ")).toBe(false);
  });
});
