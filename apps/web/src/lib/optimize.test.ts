import { describe, expect, it } from "vitest";
import { computeExperimentOffer, countInterestedSince } from "./optimize";

// Champion-aware experiment offer (review-round fix): the "start the test" offer used to be
// built champion-BLIND, so it could keep suggesting a challenger the account had already adopted
// as its champion — and clicking it would insert a signature-equal (accidental A/A) experiment.
describe("computeExperimentOffer", () => {
  it("offers a champion-aware challenger for a fresh account (empty champion)", () => {
    const offer = computeExperimentOffer("reply", {});
    expect(offer).toEqual({ stageKey: "reply", label: "a tighter, one-sentence follow-up" });
  });

  it("is champion-aware: once the fixed challenger is adopted as champion, it never re-offers the same thing", () => {
    // The account already adopted `{followupLength: "tight"}` as its champion — the OLD
    // champion-blind proposeChallengerStrategy("reply") would keep proposing exactly that same
    // strategy forever (a would-be identical-arm experiment). The champion-aware offer flips to
    // the other value instead.
    const offer = computeExperimentOffer("reply", { followupLength: "tight" });
    expect(offer).toEqual({ stageKey: "reply", label: "a standard-length follow-up" });
    expect(offer?.label).not.toBe("a tighter, one-sentence follow-up");
  });

  it("suppresses the offer for `close` (no copy-controllable challenger)", () => {
    expect(computeExperimentOffer("close", {})).toBeNull();
  });
});

describe("countInterestedSince", () => {
  const interested = [
    { lead_id: "a", received_at: "2026-07-10T00:00:00Z" },
    { lead_id: "a", received_at: "2026-07-12T00:00:00Z" }, // same lead twice → 1
    { lead_id: "b", received_at: "2026-07-01T00:00:00Z" }, // before adoption → excluded
    { lead_id: "c", received_at: "2026-07-13T00:00:00Z" }, // lead not in stamped set → excluded
  ];

  it("counts distinct stamped leads with an interested reply after adoption", () => {
    expect(countInterestedSince(new Set(["a", "b"]), interested, "2026-07-05T00:00:00Z")).toBe(1);
  });

  it("null concludedAt counts all stamped interested leads", () => {
    expect(countInterestedSince(new Set(["a", "b"]), interested, null)).toBe(2);
  });
});
