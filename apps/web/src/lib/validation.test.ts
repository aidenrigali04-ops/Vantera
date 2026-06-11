import { describe, expect, it } from "vitest";
import {
  confirmAccountName,
  dollarsToCents,
  validateOnboarding,
  validateSignup,
  validateWorkspace,
} from "./validation";

describe("dollarsToCents", () => {
  it("parses plain and formatted dollars", () => {
    expect(dollarsToCents("5000")).toBe(500_000);
    expect(dollarsToCents("12,500.50")).toBe(1_250_050);
    expect(dollarsToCents("$25,000")).toBe(2_500_000);
  });

  it("rejects non-positive and junk input", () => {
    expect(dollarsToCents("0")).toBeNull();
    expect(dollarsToCents("-10")).toBeNull();
    expect(dollarsToCents("abc")).toBeNull();
    expect(dollarsToCents("")).toBeNull();
  });
});

describe("validateOnboarding", () => {
  const good = { industry: "SaaS", icp: "Mid-market CTOs", revenueGoal: "25000" };

  it("accepts complete answers", () => {
    expect(validateOnboarding(good)).toEqual({
      ok: true,
      values: { industry: "SaaS", icp: "Mid-market CTOs", revenueGoalCents: 2_500_000 },
    });
  });

  it.each([
    [{ ...good, industry: "  " }, "industry"],
    [{ ...good, icp: "" }, "ICP"],
    [{ ...good, revenueGoal: "0" }, "revenue goal"],
  ])("rejects %j", (input, field) => {
    const result = validateOnboarding(input);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.toLowerCase()).toContain(field.toLowerCase());
  });
});

describe("validateSignup", () => {
  it("requires email, 8+ char password, company name", () => {
    expect(
      validateSignup({ email: "a@b.co", password: "longenough", companyName: "Acme" }).ok
    ).toBe(true);
    expect(validateSignup({ email: "", password: "longenough", companyName: "Acme" }).ok).toBe(
      false
    );
    expect(validateSignup({ email: "a@b.co", password: "short", companyName: "Acme" }).ok).toBe(
      false
    );
    expect(
      validateSignup({ email: "a@b.co", password: "longenough", companyName: " " }).ok
    ).toBe(false);
  });
});

describe("validateWorkspace", () => {
  it("requires a name and valid onboarding fields", () => {
    expect(
      validateWorkspace({ name: "Acme", industry: "SaaS", icp: "CTOs", revenueGoal: "1000" }).ok
    ).toBe(true);
    expect(
      validateWorkspace({ name: " ", industry: "SaaS", icp: "CTOs", revenueGoal: "1000" }).ok
    ).toBe(false);
    expect(
      validateWorkspace({ name: "Acme", industry: "SaaS", icp: "CTOs", revenueGoal: "junk" }).ok
    ).toBe(false);
  });
});

describe("confirmAccountName", () => {
  it("requires an exact (trimmed) match", () => {
    expect(confirmAccountName("Acme Inc", " Acme Inc ")).toBe(true);
    expect(confirmAccountName("Acme Inc", "acme inc")).toBe(false);
    expect(confirmAccountName("Acme Inc", "")).toBe(false);
  });
});
