import { describe, expect, it } from "vitest";
import { FOUNDER_BILLING_EMAIL, isFounderBillingExempt } from "./founder-exempt";

describe("founder billing exemption", () => {
  it("skips payment only for the founder email when they own or admin the account", () => {
    expect(isFounderBillingExempt(FOUNDER_BILLING_EMAIL, "owner")).toBe(true);
    expect(isFounderBillingExempt(" Aiden@VanteraSystem.com ", "admin")).toBe(true);
    expect(isFounderBillingExempt(FOUNDER_BILLING_EMAIL, "member")).toBe(false);
    expect(isFounderBillingExempt("other@vanterasystem.com", "owner")).toBe(false);
    expect(isFounderBillingExempt(null, "owner")).toBe(false);
    expect(isFounderBillingExempt(FOUNDER_BILLING_EMAIL, null)).toBe(false);
  });
});
