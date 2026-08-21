import { describe, expect, it } from "vitest";
import {
  confirmAccountName,
  dollarsToCents,
  normalizeWebsiteUrl,
  optionalDollarsToCents,
  validateOnboarding,
  validateOnboardingDetails,
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

describe("normalizeWebsiteUrl", () => {
  it("treats blank as no website", () => {
    expect(normalizeWebsiteUrl("")).toEqual({ ok: true, url: null });
    expect(normalizeWebsiteUrl("   ")).toEqual({ ok: true, url: null });
  });

  it("prepends https:// when no scheme is given", () => {
    expect(normalizeWebsiteUrl("acme.com")).toEqual({ ok: true, url: "https://acme.com" });
    expect(normalizeWebsiteUrl(" www.acme.io/about ")).toEqual({
      ok: true,
      url: "https://www.acme.io/about",
    });
  });

  it("keeps explicit http(s) URLs as typed", () => {
    expect(normalizeWebsiteUrl("https://acme.com/pricing")).toEqual({
      ok: true,
      url: "https://acme.com/pricing",
    });
    expect(normalizeWebsiteUrl("http://acme.com")).toEqual({ ok: true, url: "http://acme.com" });
  });

  it.each(["not a url", "ftp://acme.com", "localhost", "https://"])(
    "rejects %j",
    (input) => {
      expect(normalizeWebsiteUrl(input).ok).toBe(false);
    }
  );
});

describe("validateOnboardingDetails", () => {
  const good = { fullName: " Jane Doe ", brandName: "Acme ", websiteUrl: "acme.com" };

  it("trims and normalizes the website to https", () => {
    expect(validateOnboardingDetails(good)).toEqual({
      ok: true,
      values: { fullName: "Jane Doe", brandName: "Acme", websiteUrl: "https://acme.com" },
    });
  });

  it.each([
    [{ ...good, fullName: "  " }, "full name"],
    [{ ...good, brandName: "" }, "brand name"],
    [{ ...good, websiteUrl: "" }, "Add your website"],
    [{ ...good, websiteUrl: "not a url" }, "valid website"],
  ])("rejects %j", (input, field) => {
    const result = validateOnboardingDetails(input);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.toLowerCase()).toContain(field.toLowerCase());
  });
});

describe("validateOnboarding", () => {
  const good = {
    companyName: "Acme",
    websiteUrl: "acme.com",
    industry: "SaaS",
    icp: "Mid-market CTOs",
    revenueGoal: "25000",
    avgDealValue: "5000",
  };

  it("accepts complete answers", () => {
    expect(validateOnboarding(good)).toEqual({
      ok: true,
      values: {
        companyName: "Acme",
        websiteUrl: "https://acme.com",
        industry: "SaaS",
        icp: "Mid-market CTOs",
        revenueGoalCents: 2_500_000,
        avgDealValueCents: 500_000,
      },
    });
  });

  it("allows the website to be blank", () => {
    const result = validateOnboarding({ ...good, websiteUrl: "" });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.values.websiteUrl).toBeNull();
  });

  it.each([
    [{ ...good, companyName: " " }, "company name"],
    [{ ...good, websiteUrl: "not a url" }, "website"],
    [{ ...good, industry: "  " }, "industry"],
    [{ ...good, icp: "" }, "target audience"],
    [{ ...good, revenueGoal: "0" }, "revenue goal"],
    [{ ...good, avgDealValue: "" }, "average deal value"],
    [{ ...good, avgDealValue: "0" }, "average deal value"],
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

describe("optionalDollarsToCents", () => {
  it("treats blank as null (not an error)", () => {
    expect(optionalDollarsToCents("")).toEqual({ ok: true, cents: null });
    expect(optionalDollarsToCents("   ")).toEqual({ ok: true, cents: null });
  });

  it("parses a positive amount", () => {
    expect(optionalDollarsToCents("$1,500")).toEqual({ ok: true, cents: 150_000 });
  });

  it("rejects non-positive or junk", () => {
    expect(optionalDollarsToCents("0").ok).toBe(false);
    expect(optionalDollarsToCents("abc").ok).toBe(false);
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

  it("defaults avg deal value to null when blank", () => {
    const result = validateWorkspace({
      name: "Acme",
      industry: "SaaS",
      icp: "CTOs",
      revenueGoal: "1000",
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.values.avgDealValueCents).toBeNull();
  });

  it("parses a provided avg deal value and rejects junk", () => {
    const ok = validateWorkspace({
      name: "Acme",
      industry: "SaaS",
      icp: "CTOs",
      revenueGoal: "1000",
      avgDealValue: "1500",
    });
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.values.avgDealValueCents).toBe(150_000);

    expect(
      validateWorkspace({
        name: "Acme",
        industry: "SaaS",
        icp: "CTOs",
        revenueGoal: "1000",
        avgDealValue: "-5",
      }).ok
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
