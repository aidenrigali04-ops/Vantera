import { describe, expect, it, vi } from "vitest";
import { MockLanguageModelV3 } from "ai/test";

// Records every grounding string the LinkedIn validator hands to the grounding checks, so the
// test pins the ACTUAL validator argument — not just leadBlock in isolation (Review Focus B:
// a steer note is prompt-only and can never become grounding).
const groundings: string[] = [];
vi.mock("./humanizer", async (importOriginal) => {
  const real = await importOriginal<typeof import("./humanizer")>();
  return {
    ...real,
    findUngroundedClaims: (text: string, grounding: string) => (groundings.push(grounding), real.findUngroundedClaims(text, grounding)),
    findUngroundedEntities: (text: string, grounding: string) => (groundings.push(grounding), real.findUngroundedEntities(text, grounding)),
  };
});

const { regenerateLinkedInStage } = await import("./linkedin");
const { leadBlock } = await import("./shared");
type DraftInput = import("./shared").DraftInput;

const INPUT: DraftInput = {
  lead: { firstName: "Dana", title: "VP Sales", companyName: "Acme", industry: "saas" },
  insights: {
    pain_points: ["pipeline coverage"],
    triggers: ["hiring 3 SDRs"],
    motivations: ["hit growth targets"],
    value_angle: "fills top-of-funnel without headcount",
    aha_moment: "qualified meetings on the calendar in week one",
    summary: "Strong fit.",
  },
  context: { cta: "book a 15-min intro", valueProp: "SDR agents that source and outreach" },
};

const DRAFT = {
  connection_note: "Dana, saw Acme grew 40% last quarter, impressive.",
  followup_message: "When teams hire SDRs in batches, pipeline usually outruns ramp time. How are you keeping sourcing ahead?",
};

describe("regenerateLinkedInStage — the validator's grounding never contains the steer", () => {
  it("passes leadBlock alone to the grounding checks", async () => {
    groundings.length = 0;
    const steer = "mention their 40% growth and the Zephyr partnership";
    const model = new MockLanguageModelV3({
      doGenerate: async () => ({
        finishReason: { unified: "stop" as const, raw: "stop" },
        usage: { inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 1, text: 1, reasoning: 0 } },
        content: [{ type: "text" as const, text: JSON.stringify(DRAFT) }],
        warnings: [],
      }),
    });
    await regenerateLinkedInStage(INPUT, "invite", steer, model);
    expect(groundings.length).toBeGreaterThan(0);
    for (const g of groundings) {
      expect(g).not.toContain(steer);
      expect(g).not.toContain("Zephyr");
      expect(g).not.toContain("40%");
      expect(g).toBe(leadBlock(INPUT));
    }
  });
});
