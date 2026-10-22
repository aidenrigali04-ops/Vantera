import { describe, expect, it } from "vitest";
import { lookalikeBucket, lookalikeCutpoints, profileText, LOOKALIKE_MIN_POSITIVES } from "./lookalike";

describe("profileText", () => {
  it("builds a compact, stable profile from the lead's own fields", () => {
    expect(
      profileText({
        title: "Co-founder & CEO",
        companyName: "Acme",
        industry: "SaaS",
        companySize: "11-50",
        location: "Austin",
        prospectOffering: "helps clinics cut no-shows",
        summary: "Founder scaling a clinic platform.",
      })
    ).toBe("Co-founder & CEO | Acme | SaaS | 11-50 | Austin | helps clinics cut no-shows | Founder scaling a clinic platform.");
  });

  it("skips empty fields and returns null when there's nothing to embed", () => {
    expect(profileText({ title: "VP Sales", companyName: null, industry: "" })).toBe("VP Sales");
    expect(profileText({ title: null, companyName: null, industry: null })).toBeNull();
  });
});

describe("lookalike buckets", () => {
  it("cuts the account's own similarity distribution into tertiles", () => {
    const cut = lookalikeCutpoints([0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]);
    expect(cut).not.toBeNull();
    expect(lookalikeBucket(0.95, cut)).toBe("high");
    expect(lookalikeBucket(0.5, cut)).toBe("mid");
    expect(lookalikeBucket(0.05, cut)).toBe("low");
  });

  it("is inert without enough evidence or similarity", () => {
    expect(lookalikeCutpoints([0.5, 0.6])).toBeNull();
    expect(lookalikeBucket(0.9, null)).toBeNull();
    expect(lookalikeBucket(null, lookalikeCutpoints([0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]))).toBeNull();
    expect(LOOKALIKE_MIN_POSITIVES).toBe(3);
  });
});
