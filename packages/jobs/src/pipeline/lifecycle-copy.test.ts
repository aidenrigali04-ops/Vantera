import { describe, expect, it } from "vitest";
import { buildLifecycleMessage, firstNameOf, type LifecycleMergeData } from "./lifecycle-copy";
import type { LifecycleSegment } from "./types";

const data = (over: Partial<LifecycleMergeData> = {}): LifecycleMergeData => ({
  firstName: "Sara",
  stalledStep: "your ideal customer profile",
  leadCount: 42,
  qualifiedCount: 11,
  ...over,
});

const SEGMENTS: LifecycleSegment[] = ["stalled_onboarding", "idle_after_onboarding", "trial_lapsed"];

describe("buildLifecycleMessage", () => {
  it("greets by first name and degrades cleanly without one", () => {
    expect(buildLifecycleMessage("trial_lapsed", 1, data(), 0)).toContain("Hey Sara,");
    expect(buildLifecycleMessage("trial_lapsed", 1, data({ firstName: null }), 0)).toContain("Hey,");
  });

  it("merges real counts into value-proof copy (idle + lapsed touch 1)", () => {
    expect(buildLifecycleMessage("idle_after_onboarding", 1, data(), 0)).toContain("42");
    expect(buildLifecycleMessage("trial_lapsed", 1, data(), 0)).toContain("42");
  });

  it("never says '0 leads' — zero-count users get the count-free variant", () => {
    for (const seed of [0, 1]) {
      const idle = buildLifecycleMessage("idle_after_onboarding", 1, data({ leadCount: 0, qualifiedCount: 0 }), seed);
      const lapsed = buildLifecycleMessage("trial_lapsed", 1, data({ leadCount: 0, qualifiedCount: 0 }), seed);
      expect(idle).not.toMatch(/\b0\b/);
      expect(lapsed).not.toMatch(/\b0\b/);
    }
  });

  it("never says '0 qualified' when leads exist but none qualified yet", () => {
    for (const seed of [0, 1]) {
      for (const segment of ["idle_after_onboarding", "trial_lapsed"] as const) {
        const msg = buildLifecycleMessage(segment, 1, data({ leadCount: 3, qualifiedCount: 0 }), seed);
        expect(msg).not.toMatch(/\b0\b/);
        expect(msg).toContain("3");
      }
    }
  });

  it("merges the stalled step into segment A touch 1", () => {
    expect(buildLifecycleMessage("stalled_onboarding", 1, data(), 0)).toContain("your ideal customer profile");
  });

  it("touch 1 always says who's messaging (founder identification, owner directive)", () => {
    for (const segment of SEGMENTS)
      for (const seed of [0, 1])
        for (const d of [data(), data({ leadCount: 0, qualifiedCount: 0, firstName: null })]) {
          const msg = buildLifecycleMessage(segment, 1, d, seed);
          expect(msg).toContain("Aiden");
          expect(msg).toContain("Vantera");
        }
  });

  it("stalled-signup copy invites the user to continue where they left off", () => {
    for (const seed of [0, 1]) {
      expect(buildLifecycleMessage("stalled_onboarding", 1, data(), seed)).toMatch(
        /where you left off/
      );
    }
  });

  it("variant pick is deterministic and seed-dependent", () => {
    const a = buildLifecycleMessage("stalled_onboarding", 1, data(), 0);
    expect(buildLifecycleMessage("stalled_onboarding", 1, data(), 0)).toBe(a);
    expect(buildLifecycleMessage("stalled_onboarding", 1, data(), 1)).not.toBe(a);
  });

  it("obeys the copy rules: no em/en dashes anywhere, ever", () => {
    for (const segment of SEGMENTS)
      for (const touch of [1, 2] as const)
        for (const seed of [0, 1])
          for (const d of [data(), data({ leadCount: 0, qualifiedCount: 0, firstName: null })]) {
            const msg = buildLifecycleMessage(segment, touch, d, seed);
            expect(msg).not.toMatch(/[—–]/);
            expect(msg.length).toBeLessThan(400); // a DM, not an email
          }
  });
});

describe("firstNameOf", () => {
  it("takes the first token", () => expect(firstNameOf("Sara Bright")).toBe("Sara"));
  it("null-safe", () => expect(firstNameOf(null)).toBeNull());
  it("rejects junk single chars", () => expect(firstNameOf("S")).toBeNull());
});
