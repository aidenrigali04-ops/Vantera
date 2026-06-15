import { describe, expect, it } from "vitest";
import { FRESHNESS_WINDOW_DAYS, needsRefresh } from "./freshness";

const now = new Date("2026-06-15T00:00:00Z");

describe("needsRefresh", () => {
  it("fresh lead inside the window → false", () => {
    const scoredAt = new Date("2026-06-10T00:00:00Z"); // 5 days
    expect(needsRefresh(scoredAt, now, FRESHNESS_WINDOW_DAYS)).toBe(false);
  });
  it("aged lead past the window → true", () => {
    const scoredAt = new Date("2026-05-30T00:00:00Z"); // 16 days
    expect(needsRefresh(scoredAt, now, FRESHNESS_WINDOW_DAYS)).toBe(true);
  });
  it("never-scored lead (null) → true (treat as stale)", () => {
    expect(needsRefresh(null, now, FRESHNESS_WINDOW_DAYS)).toBe(true);
  });
});
