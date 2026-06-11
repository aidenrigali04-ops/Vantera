import { describe, expect, it } from "vitest";
import { computeNextRunAt, nextOccurrence } from "./schedule";

describe("nextOccurrence", () => {
  it("returns today's slot when it is still ahead", () => {
    const after = new Date("2026-06-11T06:00:00Z");
    expect(nextOccurrence("08:00", "UTC", after).toISOString()).toBe("2026-06-11T08:00:00.000Z");
  });

  it("rolls to tomorrow when today's slot has passed", () => {
    const after = new Date("2026-06-11T09:00:00Z");
    expect(nextOccurrence("08:00", "UTC", after).toISOString()).toBe("2026-06-12T08:00:00.000Z");
  });

  it("is strictly after: an exact hit rolls forward", () => {
    const after = new Date("2026-06-11T08:00:00Z");
    expect(nextOccurrence("08:00", "UTC", after).toISOString()).toBe("2026-06-12T08:00:00.000Z");
  });

  it("resolves wall-clock time in the agent's timezone", () => {
    const after = new Date("2026-06-11T00:00:00Z");
    // 8 AM in New York during DST = 12:00 UTC
    expect(nextOccurrence("08:00", "America/New_York", after).toISOString()).toBe(
      "2026-06-11T12:00:00.000Z"
    );
  });

  it("keeps the local time across a DST transition", () => {
    // the night before US DST ends (Nov 1 2026, clocks back at 02:00)
    const after = new Date("2026-10-31T20:00:00Z");
    // 8 AM New York on Nov 1 is back to UTC-5 = 13:00 UTC
    expect(nextOccurrence("08:00", "America/New_York", after).toISOString()).toBe(
      "2026-11-01T13:00:00.000Z"
    );
  });

  it("handles pg time format with seconds", () => {
    const after = new Date("2026-06-11T06:00:00Z");
    expect(nextOccurrence("08:00:00", "UTC", after).toISOString()).toBe(
      "2026-06-11T08:00:00.000Z"
    );
  });
});

describe("computeNextRunAt", () => {
  it("daily advances to the next day after a run", () => {
    const from = new Date("2026-06-11T08:00:05Z");
    expect(computeNextRunAt("08:00", "daily", "UTC", from).toISOString()).toBe(
      "2026-06-12T08:00:00.000Z"
    );
  });

  it("weekly advances ~7 days at the same wall-clock time", () => {
    const from = new Date("2026-06-11T08:00:05Z");
    expect(computeNextRunAt("08:00", "weekly", "UTC", from).toISOString()).toBe(
      "2026-06-18T08:00:00.000Z"
    );
  });
});
