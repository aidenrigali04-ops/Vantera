import { describe, expect, it } from "vitest";
import { MockLanguageModelV3 } from "ai/test";
import { deriveIcpCriteria, normalizeCriteria } from "./derive-criteria";

function textResponse(json: unknown) {
  return {
    finishReason: { unified: "stop" as const, raw: "stop" },
    usage: { inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 20, text: 20, reasoning: 0 } },
    content: [{ type: "text" as const, text: JSON.stringify(json) }],
    warnings: [],
  };
}

const raw = (over: Partial<Record<"titles" | "seniorities" | "industries" | "geos" | "companySizes", string[]>> = {}) => ({
  reasoning: "buyer is the founder",
  titles: [],
  seniorities: [],
  industries: [],
  geos: [],
  companySizes: [],
  ...over,
});

describe("normalizeCriteria", () => {
  it("keeps only non-empty fields, trims, dedupes, and caps list length", () => {
    const out = normalizeCriteria(
      raw({
        titles: [" CEO ", "CEO", "", ...Array.from({ length: 15 }, (_, i) => `T${i}`)],
        geos: ["Qatar"],
      })
    );
    expect(out.titles).toHaveLength(10);
    expect(out.titles![0]).toBe("CEO");
    expect(out.geos).toEqual(["Qatar"]);
    expect(out.industries).toBeUndefined();
    expect(out.companySizes).toBeUndefined();
  });

  it("drops seniorities whenever titles exist — the gate ANDs both against one title", () => {
    const both = normalizeCriteria(raw({ titles: ["CEO"], seniorities: ["C-level"] }));
    expect(both.titles).toEqual(["CEO"]);
    expect(both.seniorities).toBeUndefined();

    const only = normalizeCriteria(raw({ seniorities: ["VP"] }));
    expect(only.seniorities).toEqual(["VP"]);
  });
});

describe("deriveIcpCriteria", () => {
  it("parses the model output into persisted criteria", async () => {
    const model = new MockLanguageModelV3({
      doGenerate: async () =>
        textResponse(
          raw({
            titles: ["Founder", "CEO"],
            industries: ["SaaS"],
            geos: ["United States"],
            companySizes: ["1-10", "11-50"],
          })
        ),
    });

    const out = await deriveIcpCriteria("Small Team SaaS Company", { accountIndustry: "software" }, model);

    expect(out).toEqual({
      titles: ["Founder", "CEO"],
      industries: ["SaaS"],
      geos: ["United States"],
      companySizes: ["1-10", "11-50"],
    });
  });

  it("retries once on a malformed response, then surfaces the parsed retry", async () => {
    let call = 0;
    const model = new MockLanguageModelV3({
      doGenerate: async () => {
        call += 1;
        if (call === 1) {
          return { ...textResponse({}), content: [{ type: "text" as const, text: "not json" }] };
        }
        return textResponse(raw({ titles: ["CTO"] }));
      },
    });

    const out = await deriveIcpCriteria("CTOs at devtools startups", {}, model);

    expect(call).toBe(2);
    expect(out.titles).toEqual(["CTO"]);
  });
});
