import { describe, expect, it } from "vitest";
import {
  confirmAccountName,
  dollarsToCents,
  normalizeWebsiteUrl,
  optionalDollarsToCents,
  looksLikeUrl,
  validateManualLead,
  validateMemberSignup,
  validateOnboarding,
  validateOnboardingDetails,

  validatePositioning,
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

describe("validatePositioning", () => {
  it("trims and passes all three, empty → null", () => {
    const r = validatePositioning({ valueProp: "  We book qualified calls.  ", brandVoice: "", guardrails: "" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.values.valueProp).toBe("We book qualified calls.");
      expect(r.values.brandVoice).toBeNull();
      expect(r.values.guardrails).toBeNull();
    }
  });
  it("rejects an over-long value prop", () => {
    const r = validatePositioning({ valueProp: "x".repeat(801), brandVoice: "", guardrails: "" });
    expect(r.ok).toBe(false);
  });
  it("accepts all three when provided", () => {
    const r = validatePositioning({ valueProp: "V", brandVoice: "warm, direct", guardrails: "never claim SOC 2" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.values.guardrails).toBe("never claim SOC 2");
  });
});

describe("confirmAccountName", () => {
  it("requires an exact (trimmed) match", () => {
    expect(confirmAccountName("Acme Inc", " Acme Inc ")).toBe(true);
    expect(confirmAccountName("Acme Inc", "acme inc")).toBe(false);
    expect(confirmAccountName("Acme Inc", "")).toBe(false);
  });
});

describe("validateMemberSignup", () => {
  it("accepts a matching email (case-insensitive) with a valid password", () => {
    const r = validateMemberSignup({
      email: "Jane@Company.com",
      password: "longenough",
      inviteEmail: "jane@company.com",
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.values.email).toBe("Jane@Company.com");
  });

  it("rejects a different address than the invite was issued to", () => {
    const r = validateMemberSignup({
      email: "other@company.com",
      password: "longenough",
      inviteEmail: "jane@company.com",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("jane@company.com");
  });

  it("enforces the password floor and email shape", () => {
    expect(
      validateMemberSignup({ email: "jane@company.com", password: "short", inviteEmail: "jane@company.com" }).ok
    ).toBe(false);
    expect(
      validateMemberSignup({ email: "not-an-email", password: "longenough", inviteEmail: "jane@company.com" }).ok
    ).toBe(false);
  });
});

describe("validateManualLead", () => {
  const base = { firstName: "Ada", lastName: "", title: "", companyName: "", linkedinUrl: "linkedin.com/in/ada" };

  it("accepts name + profile URL, normalizes the URL, nulls empty optionals", () => {
    const r = validateManualLead({ ...base, lastName: "  Lovelace ", title: "CTO", companyName: "" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.values).toEqual({
        firstName: "Ada",
        lastName: "Lovelace",
        title: "CTO",
        companyName: null,
        linkedinUrl: "https://linkedin.com/in/ada",
      });
    }
  });

  it("requires a first name", () => {
    expect(validateManualLead({ ...base, firstName: "  " }).ok).toBe(false);
  });

  it("requires a PROFILE url — company pages and non-LinkedIn hosts are rejected", () => {
    expect(validateManualLead({ ...base, linkedinUrl: "linkedin.com/company/acme" }).ok).toBe(false);
    expect(validateManualLead({ ...base, linkedinUrl: "https://example.com/in/ada" }).ok).toBe(false);
    expect(validateManualLead({ ...base, linkedinUrl: "" }).ok).toBe(false);
  });

  it("caps field lengths", () => {
    expect(validateManualLead({ ...base, companyName: "x".repeat(121) }).ok).toBe(false);
  });
});

describe("looksLikeUrl guards (T6 — the first external signup pasted a LinkedIn URL as a name)", () => {
  it("detects URL-shaped values", () => {
    expect(looksLikeUrl("https://www.linkedin.com/in/someone?utm_source=share")).toBe(true);
    expect(looksLikeUrl("www.acme.com")).toBe(true);
    expect(looksLikeUrl("Acme Marketing")).toBe(false);
    expect(looksLikeUrl("B2B SaaS")).toBe(false);
  });

  it("signup rejects a LinkedIn URL as company name with the specific hint", () => {
    const r = validateSignup({
      email: "a@b.com",
      password: "longenough",
      companyName: "https://www.linkedin.com/in/someone-123?utm_source=share_via",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("connect LinkedIn");
  });

  it("workspace targeting rejects links in industry and ICP", () => {
    const base = { name: "Acme", revenueGoal: "1000" };
    expect(validateWorkspace({ ...base, industry: "https://acme.com", icp: "founders" }).ok).toBe(false);
    expect(validateWorkspace({ ...base, industry: "B2B SaaS", icp: "linkedin.com/in/x" }).ok).toBe(false);
    expect(validateWorkspace({ ...base, industry: "B2B SaaS", icp: "SaaS founders" }).ok).toBe(true);
  });
});
