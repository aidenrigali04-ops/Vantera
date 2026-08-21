import { describe, expect, it } from "vitest";
import { MockLanguageModelV3 } from "ai/test";
import { draftIcp, EMPTY_ICP_DRAFT, icpDraftIsEmpty } from "./icp-draft";

function textResponse(json: unknown) {
  return {
    finishReason: { unified: "stop" as const, raw: "stop" },
    usage: { inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 1, text: 1, reasoning: 0 } },
    content: [{ type: "text" as const, text: JSON.stringify(json) }],
    warnings: [],
  };
}

const SCAN = {
  summary: "Acme sells pipeline analytics to B2B SaaS sales teams.",
  offerings: ["pipeline analytics", "forecasting"],
  value_props: ["close more deals"],
  scope_of_industry: "B2B SaaS sales tooling",
};

describe("draftIcp", () => {
  it("normalizes the draft: dedupes, caps, keeps only known size buckets", async () => {
    const model = new MockLanguageModelV3({
      doGenerate: async () =>
        textResponse({
          name: "  Heads of Sales · B2B SaaS ",
          titles: ["VP of Sales", "vp of sales", "Head of Revenue", "CRO", "Founder", "Sales Director", "RevOps Lead"],
          industries: ["Software Development", "Software Development", "IT Services"],
          companySizes: ["11-50", "51–200", "50-500", "200+", " 1-10 "],
          geos: ["United States"],
          signals: ["hiring SDRs", "just raised a seed round"],
        }),
    });

    const out = await draftIcp({ companyName: "Acme", scan: SCAN }, model);

    expect(out.name).toBe("Heads of Sales · B2B SaaS");
    expect(out.titles).toEqual(["VP of Sales", "Head of Revenue", "CRO", "Founder", "Sales Director", "RevOps Lead"]); // deduped + capped to 6
    expect(out.industries).toEqual(["Software Development", "IT Services"]);
    expect(out.companySizes).toEqual(["11-50", "51-200", "200+", "1-10"]); // en-dash + spaces normalized, "50-500" dropped
    expect(out.geos).toEqual(["United States"]);
    expect(out.signals).toEqual(["hiring SDRs", "just raised a seed round"]);
    expect(icpDraftIsEmpty(out)).toBe(false);
  });

  it("names the profile from the first title + industry when the model leaves name blank", async () => {
    const model = new MockLanguageModelV3({
      doGenerate: async () => textResponse({ titles: ["Founder"], industries: ["Marketing Services"] }),
    });
    const out = await draftIcp({ scan: SCAN }, model);
    expect(out.name).toBe("Founder · Marketing Services");
  });

  it("falls back to 'Ideal buyers' with nothing to name", async () => {
    const model = new MockLanguageModelV3({ doGenerate: async () => textResponse({}) });
    const out = await draftIcp({ scan: SCAN }, model);
    expect(out.name).toBe("Ideal buyers");
    expect(icpDraftIsEmpty(out)).toBe(true);
  });

  it("fails open to the empty draft when the model errors (never blocks onboarding)", async () => {
    const model = new MockLanguageModelV3({
      doGenerate: async () => {
        throw new Error("model down");
      },
    });
    await expect(draftIcp({ scan: SCAN }, model)).resolves.toEqual(EMPTY_ICP_DRAFT);
  });
});
