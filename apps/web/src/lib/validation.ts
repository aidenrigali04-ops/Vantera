export type Valid<T> = { ok: true; values: T };
export type Invalid = { ok: false; error: string };

export function dollarsToCents(input: string): number | null {
  const cleaned = input.replace(/[$,\s]/g, "");
  // eslint-disable-next-line security/detect-unsafe-regex -- safe: bounded, no nested quantifier (no ReDoS)
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const cents = Math.round(parseFloat(cleaned) * 100);
  return cents > 0 ? cents : null;
}

/** Optional positive dollar amount: blank → null; otherwise must parse to > 0. */
export function optionalDollarsToCents(
  input: string
): { ok: true; cents: number | null } | Invalid {
  const trimmed = input.trim();
  if (!trimmed) return { ok: true, cents: null };
  const cents = dollarsToCents(trimmed);
  if (cents === null) {
    return { ok: false, error: "Enter a value per client greater than zero, or leave it blank." };
  }
  return { ok: true, cents };
}

/** Blank means "no website"; otherwise require an http(s) URL, defaulting the scheme to https. */
export function normalizeWebsiteUrl(input: string): { ok: true; url: string | null } | Invalid {
  const trimmed = input.trim();
  if (!trimmed) return { ok: true, url: null };
  const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const parsed = new URL(candidate);
    if (
      (parsed.protocol === "http:" || parsed.protocol === "https:") &&
      parsed.hostname.includes(".")
    ) {
      return { ok: true, url: candidate };
    }
  } catch {
    // fall through to the shared error
  }
  return { ok: false, error: "Enter a valid website address, or leave it blank." };
}

function validateTargeting(input: {
  industry: string;
  icp: string;
  revenueGoal: string;
}): Valid<{ industry: string; icp: string; revenueGoalCents: number }> | Invalid {
  const industry = input.industry.trim();
  const icp = input.icp.trim();
  if (!industry) return { ok: false, error: "Enter your industry." };
  if (!icp) return { ok: false, error: "Describe your target audience." };
  const revenueGoalCents = dollarsToCents(input.revenueGoal);
  if (revenueGoalCents === null) {
    return { ok: false, error: "Enter a monthly revenue goal greater than zero." };
  }
  return { ok: true, values: { industry, icp, revenueGoalCents } };
}

export function validateOnboarding(input: {
  companyName: string;
  websiteUrl: string;
  industry: string;
  icp: string;
  revenueGoal: string;
  avgDealValue: string;
}):
  | Valid<{
      companyName: string;
      websiteUrl: string | null;
      industry: string;
      icp: string;
      revenueGoalCents: number;
      avgDealValueCents: number;
    }>
  | Invalid {
  const companyName = input.companyName.trim();
  if (!companyName) return { ok: false, error: "Enter your company name." };
  const website = normalizeWebsiteUrl(input.websiteUrl);
  if (!website.ok) return website;
  const targeting = validateTargeting(input);
  if (!targeting.ok) return targeting;
  // Required at onboarding (commitment device): it turns every qualified lead into a dollar
  // figure, so the dashboard's pipeline + revenue proof renders from the first lead, not blanks.
  const avgDealValueCents = dollarsToCents(input.avgDealValue);
  if (avgDealValueCents === null) {
    return { ok: false, error: "Enter your average deal value (what one new client is worth)." };
  }
  return {
    ok: true,
    values: { companyName, websiteUrl: website.url, ...targeting.values, avgDealValueCents },
  };
}

/**
 * Step 1 of onboarding — the only three things the product can't infer. The website is
 * REQUIRED here (unlike the legacy wizard): the scan is what derives the ICP, so without
 * it the agents would have nothing to target.
 */
export function validateOnboardingDetails(input: {
  fullName: string;
  brandName: string;
  websiteUrl: string;
}): Valid<{ fullName: string; brandName: string; websiteUrl: string }> | Invalid {
  const fullName = input.fullName.trim();
  if (!fullName) return { ok: false, error: "Enter your full name." };
  if (fullName.length > 120) return { ok: false, error: "That name is too long." };
  const brandName = input.brandName.trim();
  if (!brandName) return { ok: false, error: "Enter your brand name." };
  if (brandName.length > 120) return { ok: false, error: "That brand name is too long." };
  const website = normalizeWebsiteUrl(input.websiteUrl);
  if (!website.ok) return { ok: false, error: "Enter a valid website address — try acme.com." };
  if (!website.url) return { ok: false, error: "Add your website — it's how we learn who you sell to." };
  return { ok: true, values: { fullName, brandName, websiteUrl: website.url } };
}

export function validateSignup(input: {
  email: string;
  password: string;
  companyName: string;
}): Valid<{ email: string; password: string; companyName: string }> | Invalid {
  const email = input.email.trim();
  const companyName = input.companyName.trim();
  if (!email || !email.includes("@")) return { ok: false, error: "Enter a valid email address." };
  if (input.password.length < 8) {
    return { ok: false, error: "Password must be at least 8 characters." };
  }
  if (!companyName) return { ok: false, error: "Enter your company name." };
  return { ok: true, values: { email, password: input.password, companyName } };
}

export function validateWorkspace(input: {
  name: string;
  industry: string;
  icp: string;
  revenueGoal: string;
  avgDealValue?: string;
}):
  | Valid<{
      name: string;
      industry: string;
      icp: string;
      revenueGoalCents: number;
      avgDealValueCents: number | null;
    }>
  | Invalid {
  const name = input.name.trim();
  if (!name) return { ok: false, error: "Workspace name can't be empty." };
  const targeting = validateTargeting(input);
  if (!targeting.ok) return targeting;
  const deal = optionalDollarsToCents(input.avgDealValue ?? "");
  if (!deal.ok) return deal;
  return { ok: true, values: { name, ...targeting.values, avgDealValueCents: deal.cents } };
}

export function confirmAccountName(accountName: string, typed: string): boolean {
  return typed.trim() === accountName;
}

/** Claim-step email validation (journey v2) — same bar as validateSignup's email field. */
export function validateEmail(raw: FormDataEntryValue | null): { email?: string; error?: string } {
  const email = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (!email || !email.includes("@") || email.length < 5) {
    return { error: "Enter a valid email address." };
  }
  return { email };
}
