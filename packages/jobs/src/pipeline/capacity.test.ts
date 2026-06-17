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
  emailEnabled: false,
  mailboxes: [],
};

const opts = {
  cadenceDays: 1,
  currentBacklog: 0,
  bufferFactor: CAPACITY_DEFAULTS.bufferFactor, // 1.3
  floor: CAPACITY_DEFAULTS.floor,               // 5
  ceiling: 25,
};

describe("dailyOutreachCapacity", () => {
  it("sums LinkedIn ramp + per-mailbox caps when channels enabled", () => {
    const cap: OutreachCapacity = {
      ...base,
      linkedinConnected: true,
      linkedinEnabled: true,
      linkedinAccountAgeDays: 3, // ramp step → 5/day
      emailEnabled: true,
      mailboxes: [
        { phase: "warming", dailyCap: 8 },
        { phase: "ready", dailyCap: 0 }, // ready ignores cap → 30
      ],
    };
    expect(dailyOutreachCapacity(cap)).toBe(5 + 8 + 30);
  });

  it("ignores a channel that is disabled even if infra exists", () => {
    const cap: OutreachCapacity = {
      ...base,
      linkedinConnected: true,
      linkedinEnabled: false, // disabled → contributes 0
      linkedinAccountAgeDays: 100,
      emailEnabled: false,
      mailboxes: [{ phase: "ready", dailyCap: 0 }],
    };
    expect(dailyOutreachCapacity(cap)).toBe(0);
  });
});

describe("computeRunTarget", () => {
  it("LinkedIn-only during warmup → small fresh trickle", () => {
    const cap: OutreachCapacity = {
      ...base,
      linkedinConnected: true,
      linkedinEnabled: true,
      linkedinAccountAgeDays: 3, // 5/day
    };
    // round(5 * 1 * 1.3) = 7, > floor 5
    expect(computeRunTarget(cap, opts)).toBe(7);
  });

  it("all ready → clamps to the ceiling", () => {
    const cap: OutreachCapacity = {
      ...base,
      linkedinConnected: true,
      linkedinEnabled: true,
      linkedinAccountAgeDays: 100, // steady 20
      emailEnabled: true,
      mailboxes: [{ phase: "ready", dailyCap: 0 }, { phase: "ready", dailyCap: 0 }], // 60
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
    // Q3: prospects pull even before outreach is set up; the dashboard nudges to
    // connect a channel. Bounded so a no-channel account can't accumulate forever.
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

  it("tiny capacity still pulls the floor batch", () => {
    const cap: OutreachCapacity = {
      ...base,
      emailEnabled: true,
      mailboxes: [{ phase: "warming", dailyCap: 2 }], // projected round(2.6)=3
    };
    expect(computeRunTarget(cap, opts)).toBe(5); // raised to floor
  });
});
