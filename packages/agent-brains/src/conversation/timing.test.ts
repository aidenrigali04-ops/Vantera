import { describe, expect, it } from "vitest";
import { REPLY_DELAY_MAX_MS, REPLY_DELAY_MIN_MS, isQuietHour, nextQuietExit, replyDelayMs } from "./timing";

describe("replyDelayMs", () => {
  it("respects the floor and ceiling", () => {
    expect(replyDelayMs(0, 0, () => 0)).toBe(REPLY_DELAY_MIN_MS);
    expect(replyDelayMs(1e12, 1e12, () => 0.999)).toBe(REPLY_DELAY_MAX_MS);
  });
  it("matches the formula at rng 0.5 (x1.1)", () => {
    const base = 4 * 60_000 + 6 * 60_000 * Math.log(1 + 160 / 80) + 4 * 60_000 * Math.log(1 + 80 / 80);
    expect(replyDelayMs(160, 80, () => 0.5)).toBeCloseTo(base * 1.1, 3);
  });
  it("longer messages mean longer delay at fixed rng", () => {
    const rng = () => 0.5;
    expect(replyDelayMs(400, 100, rng)).toBeGreaterThan(replyDelayMs(40, 100, rng));
    expect(replyDelayMs(100, 400, rng)).toBeGreaterThan(replyDelayMs(100, 40, rng));
  });
});

describe("isQuietHour", () => {
  it("is quiet at 03:30 Berlin and not at 11:00 Berlin", () => {
    expect(isQuietHour(new Date("2026-10-28T02:30:00Z"), "Europe/Berlin")).toBe(true);
    expect(isQuietHour(new Date("2026-10-28T10:00:00Z"), "Europe/Berlin")).toBe(false);
  });
  it("covers 21:00 through 06:59 local", () => {
    expect(isQuietHour(new Date("2026-10-28T21:00:00Z"), "UTC")).toBe(true);
    expect(isQuietHour(new Date("2026-10-28T20:59:00Z"), "UTC")).toBe(false);
    expect(isQuietHour(new Date("2026-10-28T06:59:00Z"), "UTC")).toBe(true);
    expect(isQuietHour(new Date("2026-10-28T07:00:00Z"), "UTC")).toBe(false);
  });
});

describe("nextQuietExit", () => {
  it("returns today 07:00 local when before 07:00", () => {
    expect(nextQuietExit(new Date("2026-10-28T02:30:00Z"), "Europe/Berlin").toISOString()).toBe("2026-10-28T06:00:00.000Z");
  });
  it("returns tomorrow 07:00 local when at or after 07:00", () => {
    expect(nextQuietExit(new Date("2026-10-28T22:00:00Z"), "UTC").toISOString()).toBe("2026-10-29T07:00:00.000Z");
    expect(nextQuietExit(new Date("2026-10-28T06:00:00Z"), "Europe/Berlin").toISOString()).toBe("2026-10-29T06:00:00.000Z");
  });
  it("handles a DST change (US fall back 2026-11-01)", () => {
    expect(nextQuietExit(new Date("2026-11-01T03:00:00Z"), "America/New_York").toISOString()).toBe("2026-11-01T12:00:00.000Z");
  });
});
