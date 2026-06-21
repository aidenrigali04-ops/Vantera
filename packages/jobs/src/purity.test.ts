import { describe, expect, it } from "vitest";
import { advanceSequence } from "./pipeline/sequence-advance";
import { SEQUENCE_DEFAULTS } from "./pipeline/sequence-config";
import type { SequenceTickContext } from "./pipeline/types";

const NOW = new Date("2026-06-14T12:00:00Z");

function ctx(): SequenceTickContext {
  return {
    run: {
      id: "r1", accountId: "a1", campaignId: "c1", leadId: "l1",
      status: "active", currentStage: "linkedin", touchesDone: 0,
      nextActionAt: NOW, enteredStageAt: NOW,
    },
    config: SEQUENCE_DEFAULTS,
    channels: {
      linkedinUrl: "https://linkedin.com/in/x",
    },
    suppressed: { linkedin: false },
    accountPaused: false,
    killSwitch: false,
    now: NOW,
  };
}

describe("advanceSequence purity", () => {
  it("is deterministic for the same input", () => {
    expect(advanceSequence(ctx())).toEqual(advanceSequence(ctx()));
  });

  it("does not mutate the input context", () => {
    const c = ctx();
    const snapshot = structuredClone(c);
    advanceSequence(c);
    expect(c).toEqual(snapshot);
  });
});
