import { describe, expect, it } from "vitest";
import { isRegenerable, regenerateOffReason } from "./regenerable";

describe("isRegenerable", () => {
  it("is true only for drafts the first-touch brain wrote", () => {
    expect(isRegenerable({ brain: "first_touch", strategy: "x" })).toBe(true);
    expect(isRegenerable({ brain: "sequence_followup" })).toBe(false);
    expect(isRegenerable({ brain: "reply" })).toBe(false);
    expect(isRegenerable(null)).toBe(false);
    expect(isRegenerable(undefined)).toBe(false);
    expect(isRegenerable({})).toBe(false);
  });
});

describe("regenerateOffReason", () => {
  it("is null when regenerable, and names why it is off otherwise", () => {
    expect(regenerateOffReason({ regenerable: true, origin: "sequence" })).toBeNull();
    expect(regenerateOffReason({ regenerable: false, origin: "reply_response" })).toMatch(/^Replies/);
    expect(regenerateOffReason({ regenerable: false, origin: "manual" })).toMatch(/^Hand-written/);
    expect(regenerateOffReason({ regenerable: false, origin: "sequence" })).toMatch(/^Follow-ups/);
  });
});
