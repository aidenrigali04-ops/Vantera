import { describe, expect, it } from "vitest";
import { shouldSkipForCrm } from "./crm-dedup";

// The "janitor effect" (report #10): cold-outreaching someone already a customer or in an open
// deal erodes trust and creates rework. The dedup gate skips those; a stale lead is fair game.
describe("shouldSkipForCrm", () => {
  it("does not skip when the contact isn't in the CRM", () => {
    expect(shouldSkipForCrm({ exists: false }).skip).toBe(false);
    expect(shouldSkipForCrm(null).skip).toBe(false);
  });

  it("skips an existing customer", () => {
    const d = shouldSkipForCrm({ exists: true, lifecycleStage: "customer" });
    expect(d.skip).toBe(true);
    expect(d.reason).toContain("customer");
  });

  it("skips a contact with an open deal regardless of stage", () => {
    expect(shouldSkipForCrm({ exists: true, lifecycleStage: "lead", openDeal: true }).skip).toBe(true);
  });

  it("normalizes stage spelling (closed-won / closed won)", () => {
    expect(shouldSkipForCrm({ exists: true, lifecycleStage: "Closed-Won" }).skip).toBe(true);
  });

  it("does not skip a stale lead with no open deal — fair game for outreach", () => {
    expect(shouldSkipForCrm({ exists: true, lifecycleStage: "lead", openDeal: false }).skip).toBe(false);
  });
});
