import { describe, expect, it } from "vitest";
import { LIFECYCLE_ADMIN_EMAIL } from "./lifecycle-outreach";
import { TRIAL_LEAD_CAP } from "./types";
import { discoveryIdleReason, exemptFromTrialCaps, statusForTrialCaps } from "./trial-caps";

describe("trial caps", () => {
  it("treats the workspace trial-expiry already skips as paid for caps", () => {
    expect(exemptFromTrialCaps([LIFECYCLE_ADMIN_EMAIL])).toBe(true);
    expect(exemptFromTrialCaps(["Other@Example.com"])).toBe(false);
    expect(statusForTrialCaps("trialing", true)).toBe("active");
    expect(statusForTrialCaps("trialing", false)).toBe("trialing");
    expect(statusForTrialCaps("canceled", true)).toBe("canceled");
  });

  it("names a zero discovery target instead of implying the gate ran", () => {
    expect(
      discoveryIdleReason({
        dailyCapacity: 5,
        discoveryBeforeTrialClamp: 150,
        discoveryTarget: 0,
        totalLeads: TRIAL_LEAD_CAP,
        trialing: true,
      })
    ).toBe("trial_cap");
    expect(
      discoveryIdleReason({
        dailyCapacity: 20,
        discoveryBeforeTrialClamp: 0,
        discoveryTarget: 0,
        totalLeads: 400,
        trialing: false,
      })
    ).toBe("pool_full");
    expect(
      discoveryIdleReason({
        dailyCapacity: 0,
        discoveryBeforeTrialClamp: 0,
        discoveryTarget: 0,
        totalLeads: 25,
        trialing: false,
      })
    ).toBe("preview_full");
    expect(
      discoveryIdleReason({
        dailyCapacity: 20,
        discoveryBeforeTrialClamp: 150,
        discoveryTarget: 150,
        totalLeads: 10,
        trialing: false,
      })
    ).toBeUndefined();
  });
});
