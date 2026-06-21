import { describe, expect, it } from "vitest";
import {
  CAPACITY_DEFAULTS,
  NO_CHANNEL_PREVIEW_CAP,
  computeRunTarget,
  dailyOutreachCapacity,
  type OutreachCapacity,
} from "./capacity";

const base: OutreachCapacity = {
  linkedinConnected: false,
  linkedinAccountAgeDays: null,
  linkedinEnabled: false,
};

const opts = {
  cadenceDays: 1,
  currentBacklog: 0,
  bufferFactor: CAPACITY_DEFAULTS.bufferFactor, // 1.3
  floor: CAPACITY_DEFAULTS.floor,               // 5
  ceiling: 25,
};

describe("dailyOutreachCapacity", () => {
  it("uses the LinkedIn ramp when connected + enabled", () => {
    const cap: OutreachCapacity = {
      ...base,
      linkedinConnected: true,
      linkedinEnabled: true,
      linkedinAccountAgeDays: 3, // ramp step → 5/day
    };
    expect(dailyOutreachCapacity(cap)).toBe(5);
  });

  it("ignores LinkedIn when disabled even if connected", () => {
    const cap: OutreachCapacity = {
      ...base,
      linkedinConnected: true,
      linkedinEnabled: false, // disabled → contributes 0
      linkedinAccountAgeDays: 100,
    };
    expect(dailyOutreachCapacity(cap)).toBe(0);
  });

  it("treats a null account age as blocked until the age is known", () => {
    const cap: OutreachCapacity = {
      ...base,
      linkedinConnected: true,
      linkedinEnabled: true,
      linkedinAccountAgeDays: null,
    };
    expect(dailyOutreachCapacity(cap)).toBe(0);
  });
});

describe("computeRunTarget", () => {
  it("LinkedIn warmup → small fresh trickle", () => {
    const cap: OutreachCapacity = {
      ...base,
      linkedinConnected: true,
      linkedinEnabled: true,
      linkedinAccountAgeDays: 3, // 5/day
    };
    // round(5 * 1 * 1.3) = 7, > floor 5
    expect(computeRunTarget(cap, opts)).toBe(7);
  });

  it("steady LinkedIn → clamps to the ceiling", () => {
    const cap: OutreachCapacity = {
      ...base,
      linkedinConnected: true,
      linkedinEnabled: true,
      linkedinAccountAgeDays: 100, // steady 20 → round(20*1.3)=26, clamped to ceiling 25
    };
    expect(computeRunTarget(cap, opts)).toBe(25);
  });

  it("backlog covering projected capacity → 0 (don't pile on)", () => {
    const cap: OutreachCapacity = {
      ...base,
      linkedinConnected: true,
      linkedinEnabled: true,
      linkedinAccountAgeDays: 3, // projected 7
    };
    expect(computeRunTarget(cap, { ...opts, currentBacklog: 10 })).toBe(0);
  });

  it("no channel yet → still sources a bounded preview batch so prospects land", () => {
    // Q3: prospects pull even before LinkedIn is connected; the dashboard nudges to
    // connect. Bounded so a no-channel account can't accumulate forever.
    expect(computeRunTarget(base, opts)).toBe(opts.floor);
  });

  it("no channel + preview backlog already full → 0 (stops accumulating)", () => {
    expect(computeRunTarget(base, { ...opts, currentBacklog: NO_CHANNEL_PREVIEW_CAP })).toBe(0);
  });

  it("no channel, near the preview cap → only tops up to the cap", () => {
    expect(
      computeRunTarget(base, { ...opts, currentBacklog: NO_CHANNEL_PREVIEW_CAP - 2 })
    ).toBe(2);
  });
});
