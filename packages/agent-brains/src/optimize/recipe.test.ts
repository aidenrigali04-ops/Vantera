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

  it("stamps bestOfN (Task 3) when the caller passes it — everything else unchanged", () => {
    expect(buildSendRecipe({ brain: "first_touch", bestOfN: 3 })).toEqual({
      v: 2,
      brain: "first_touch",
      strategy: {},
      experimentId: null,
      variant: null,
      playbookVersion: null,
      exemplars: 0,
      promptHash: null,
      modelId: null,
      bestOfN: 3,
    });
  });

  it("omits bestOfN entirely when absent (not a null sentinel) — byte-identical to pre-Task-3 callers", () => {
    const recipe = buildSendRecipe({ brain: "conversation_reply" });
    expect(recipe).not.toHaveProperty("bestOfN");
    expect(Object.keys(recipe).sort()).toEqual(
      ["brain", "exemplars", "experimentId", "modelId", "playbookVersion", "promptHash", "strategy", "v", "variant"].sort()
    );
  });
});
