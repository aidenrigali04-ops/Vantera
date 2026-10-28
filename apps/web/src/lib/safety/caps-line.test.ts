import { describe, expect, it } from "vitest";
import { capsTrustLine, rampLabel, type CapsInput } from "./caps-line";

const RAMP: CapsInput["ramp"] = [
  { maxAgeDays: 7, daily: 5 },
  { maxAgeDays: 14, daily: 10 },
  { maxAgeDays: 28, daily: 15 },
];

describe("capsTrustLine", () => {
  it("states the real caps in one sentence", () => {
    expect(capsTrustLine({ dailyInvites: 20, dailyMessages: 25, weeklyInvites: 100, ramp: RAMP })).toBe(
      "Sends stay within LinkedIn-safe limits: 20 invites a day once ramped (5 → 10 → 15 over the first four weeks), 25 messages a day, about 100 invites a week."
    );
  });

  it("follows the numbers it is given", () => {
    const line = capsTrustLine({ dailyInvites: 12, dailyMessages: 9, weeklyInvites: 60, ramp: [{ maxAgeDays: 14, daily: 4 }] });
    expect(line).toContain("12 invites a day once ramped (4 over the first two weeks)");
    expect(line).toContain("9 messages a day");
    expect(line).toContain("about 60 invites a week");
  });

  it("drops the ramp clause when there is no ramp", () => {
    expect(capsTrustLine({ dailyInvites: 20, dailyMessages: 25, weeklyInvites: 100, ramp: [] })).toBe(
      "Sends stay within LinkedIn-safe limits: 20 invites a day, 25 messages a day, about 100 invites a week."
    );
  });
});

describe("rampLabel", () => {
  it("walks the ramp to the steady rate", () => {
    expect(rampLabel(RAMP, 20)).toBe("5 → 10 → 15 → 20/day over the first four weeks");
  });

  it("words the period for any ramp length", () => {
    const threeWeeks: CapsInput["ramp"] = [{ maxAgeDays: 7, daily: 5 }, { maxAgeDays: 21, daily: 10 }];
    expect(rampLabel(threeWeeks, 20)).toBe("5 → 10 → 20/day over the first three weeks");
    const oneWeek: CapsInput["ramp"] = [{ maxAgeDays: 7, daily: 5 }];
    expect(rampLabel(oneWeek, 20)).toBe("5 → 20/day over the first week");
    expect(capsTrustLine({ dailyInvites: 20, dailyMessages: 25, weeklyInvites: 100, ramp: oneWeek })).toContain(
      "(5 over the first week)"
    );
  });
});
