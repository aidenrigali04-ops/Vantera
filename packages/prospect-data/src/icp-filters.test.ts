import { describe, expect, it } from "vitest";
import { icpCriteriaToFilters } from "./icp-filters";

describe("icpCriteriaToFilters", () => {
  it("maps every criteria field onto discovery filters", () => {
    expect(
      icpCriteriaToFilters({
        industries: ["SaaS"],
        companySizes: ["11-50"],
        titles: ["CTO"],
        seniorities: ["c_suite"],
        geos: ["United States"],
        techStack: ["Salesforce"],
      })
    ).toEqual({
      industries: ["saas"],
      companySizes: ["11-50"],
      titles: ["cto"],
      seniorities: ["c_suite"],
      geos: ["united states"],
      techStack: ["salesforce"],
    });
  });

  it("drops empty arrays and trims whitespace", () => {
    expect(icpCriteriaToFilters({ industries: ["  Fintech "], titles: [] })).toEqual({
      industries: ["fintech"],
    });
  });

  it("returns an empty filter set for empty criteria", () => {
    expect(icpCriteriaToFilters({})).toEqual({});
  });

  it("tolerates unknown jsonb shapes (non-array values ignored)", () => {
    expect(
      icpCriteriaToFilters({ industries: "SaaS" as unknown as string[] })
    ).toEqual({});
  });
});
