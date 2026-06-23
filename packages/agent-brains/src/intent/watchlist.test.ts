import { describe, expect, it } from "vitest";
import { MockLanguageModelV3 } from "ai/test";
import { deriveIntentWatchlist } from "./watchlist";

function textResponse(json: unknown) {
  return {
    finishReason: { unified: "stop" as const, raw: "stop" },
    usage: { inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 1, text: 1, reasoning: 0 } },
    content: [{ type: "text" as const, text: JSON.stringify(json) }],
    warnings: [],
  };
}

describe("deriveIntentWatchlist", () => {
  it("derives watch targets, strips leading #, dedupes, and caps each list", async () => {
    const model = new MockLanguageModelV3({
      doGenerate: async () =>
        textResponse({
          keywords: ["looking for a churn tool", "looking for a churn tool", "switching from Salesforce"],
          hashtags: ["#revops", "RevOps", "customersuccess"], // "#revops" + "RevOps" collapse after strip+lowercase
          competitors: ["Salesforce", "Gainsight", "Gainsight", "Catalyst", "Vitally", "Totango", "ChurnZero", "OneMore"],
        }),
    });

    const out = await deriveIntentWatchlist(
      { industry: "SaaS", offering: "reduce onboarding churn", icp: "RevOps leaders at B2B SaaS" },
      model
    );

    expect(out.keywords).toEqual(["looking for a churn tool", "switching from Salesforce"]); // deduped
    expect(out.hashtags).toEqual(["revops", "customersuccess"]); // # stripped + case-deduped
    expect(out.competitors).toEqual(["Salesforce", "Gainsight", "Catalyst", "Vitally", "Totango", "ChurnZero"]); // deduped + capped to 6
  });

  it("fails open to empty lists when the model errors (never blocks the wizard)", async () => {
    const model = new MockLanguageModelV3({
      doGenerate: async () => {
        throw new Error("model down");
      },
    });
    const out = await deriveIntentWatchlist({ industry: "SaaS" }, model);
    expect(out).toEqual({ keywords: [], hashtags: [], competitors: [] });
  });
});
