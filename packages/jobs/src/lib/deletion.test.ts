import { describe, expect, it } from "vitest";
import { GRACE_DAYS, isEligibleForDeletion } from "./deletion";

describe("isEligibleForDeletion", () => {
  const now = new Date("2026-06-11T00:00:00Z");

  it("is not eligible inside the grace window", () => {
    expect(isEligibleForDeletion(new Date("2026-06-05T00:00:00Z"), now)).toBe(false);
    expect(isEligibleForDeletion(now, now)).toBe(false);
  });

  it("is eligible once the grace window has passed", () => {
    expect(isEligibleForDeletion(new Date("2026-06-04T00:00:00Z"), now)).toBe(true);
    expect(isEligibleForDeletion(new Date("2026-05-01T00:00:00Z"), now)).toBe(true);
  });

  it("uses a 7-day grace window", () => {
    expect(GRACE_DAYS).toBe(7);
  });
});
