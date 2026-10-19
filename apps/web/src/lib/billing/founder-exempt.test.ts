import { describe, expect, it } from "vitest";
import { FOUNDER_BILLING_EMAIL, isFounderBillingExempt } from "./founder-exempt";

describe("founder billing exemption", () => {
  it("treats the founder email as admin regardless of membership role", () => {
    expect(isFounderBillingExempt(FOUNDER_BILLING_EMAIL, "owner")).toBe(true);
    expect(isFounderBillingExempt(" Aiden@VanteraSystem.com ", "admin")).toBe(true);
    expect(isFounderBillingExempt(FOUNDER_BILLING_EMAIL, "member")).toBe(true);
    expect(isFounderBillingExempt(FOUNDER_BILLING_EMAIL, null)).toBe(true);
    expect(isFounderBillingExempt("other@vanterasystem.com", "owner")).toBe(false);
    expect(isFounderBillingExempt(null, "owner")).toBe(false);
  });
});
