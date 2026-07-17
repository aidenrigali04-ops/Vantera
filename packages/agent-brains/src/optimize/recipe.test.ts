import { describe, expect, it } from "vitest";
import { buildSendRecipe } from "./recipe";

describe("buildSendRecipe", () => {
  it("stamps v2 with full attribution when everything is known", () => {
    expect(
      buildSendRecipe({
        brain: "first_touch",
        strategy: { openWith: "pain" },
        experimentId: "exp-1",
        variant: "challenger",
        playbookVersion: 3,
        exemplars: 2,
        promptHash: "abc",
        modelId: "claude-x",
      })
    ).toEqual({
      v: 2,
      brain: "first_touch",
      strategy: { openWith: "pain" },
      experimentId: "exp-1",
      variant: "challenger",
      playbookVersion: 3,
      exemplars: 2,
      promptHash: "abc",
      modelId: "claude-x",
    });
  });

  it("normalizes absent fields to honest nulls/empties (conversation paths)", () => {
    expect(buildSendRecipe({ brain: "conversation_reply" })).toEqual({
      v: 2,
      brain: "conversation_reply",
      strategy: {},
      experimentId: null,
      variant: null,
      playbookVersion: null,
      exemplars: 0,
      promptHash: null,
      modelId: null,
    });
  });

  it("floors exemplars at 0 and truncates fractions", () => {
    expect(buildSendRecipe({ brain: "sequence_followup", exemplars: -1 }).exemplars).toBe(0);
    expect(buildSendRecipe({ brain: "sequence_followup", exemplars: 2.7 }).exemplars).toBe(2);
  });
});
