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

/**
 * T6: structural-garbage guard. The first real external signup pasted their LinkedIn
 * profile URL into a name field and their surname into industry — a URL in any of these
 * fields poisons every downstream surface (workspace title, emails, ICP derivation),
 * so it's rejected at the door with a field-specific hint.
 */
export function looksLikeUrl(value: string): boolean {
  const v = value.trim().toLowerCase();
  return /^https?:\/\//.test(v) || /^www\./.test(v) || /(linkedin\.com|\.com\/|\.dev\/|\.io\/|\.net\/)/.test(v);
}

function validateTargeting(input: {
  industry: string;
  icp: string;
  revenueGoal: string;
}): Valid<{ industry: string; icp: string; revenueGoalCents: number }> | Invalid {
  const industry = input.industry.trim();
  const icp = input.icp.trim();
  if (!industry) return { ok: false, error: "Enter your industry." };
  if (looksLikeUrl(industry)) {
    return { ok: false, error: "Industry should be a market, not a link — e.g. “B2B SaaS” or “Marketing agencies”." };
  }
  if (!icp) return { ok: false, error: "Describe your target audience." };
  if (looksLikeUrl(icp)) {
    return { ok: false, error: "Describe your target audience in words (who they are), not a link." };
  }
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

/** Blank means "not provided"; otherwise require a linkedin.com URL, defaulting the scheme to https. */
export function normalizeLinkedinUrl(input: string): { ok: true; url: string | null } | Invalid {
  const trimmed = input.trim();
  if (!trimmed) return { ok: true, url: null };
  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const parsed = new URL(candidate);
    if (
      (parsed.protocol === "http:" || parsed.protocol === "https:") &&
      /(^|\.)linkedin\.com$/i.test(parsed.hostname)
    ) {
      return { ok: true, url: candidate };
    }
  } catch {
    // fall through
  }
  return { ok: false, error: "Enter a valid LinkedIn URL (linkedin.com/in/…), or leave it blank." };
}

/**
 * Step 1 "Personalize": identity only — what we can't derive. Industry/ICP/goals are derived from
 * the website/LinkedIn pull and confirmed later, so they're NOT collected here (B=MAP: cut fields).
 */
export function validatePersonalize(input: {
  companyName: string;
  role: string;
  websiteUrl: string;
  linkedinUrl: string;
}):
  | Valid<{ companyName: string; role: string; websiteUrl: string | null; linkedinUrl: string | null }>
  | Invalid {
  const companyName = input.companyName.trim();
  if (!companyName) return { ok: false, error: "Enter your company name." };
  if (looksLikeUrl(companyName)) {
    return { ok: false, error: "That looks like a link — the website and LinkedIn fields are below. Enter your company's name here." };
  }
  const role = input.role.trim();
  if (!role) return { ok: false, error: "Select your role." };
  const website = normalizeWebsiteUrl(input.websiteUrl);
  if (!website.ok) return website;
  const linkedin = normalizeLinkedinUrl(input.linkedinUrl);
  if (!linkedin.ok) return linkedin;
  return { ok: true, values: { companyName, role, websiteUrl: website.url, linkedinUrl: linkedin.url } };
}

/**
 * Step 3 "Confirmation": the derived targeting + goal, confirmed/edited by the user. Same fields the
 * Scout (targeting) and dashboard (dollar tracking) depend on — required before "Find my first leads".
 */
export function validateConfirmation(input: {
  industry: string;
  icp: string;
  revenueGoal: string;
  avgDealValue: string;
}):
  | Valid<{ industry: string; icp: string; revenueGoalCents: number; avgDealValueCents: number }>
  | Invalid {
  const targeting = validateTargeting(input);
  if (!targeting.ok) return targeting;
  const avgDealValueCents = dollarsToCents(input.avgDealValue);
  if (avgDealValueCents === null) {
    return { ok: false, error: "Enter your average deal value (what one new client is worth)." };
  }
  return { ok: true, values: { ...targeting.values, avgDealValueCents } };
}

const VALUE_PROP_MAX = 800;
const BRAND_VOICE_MAX = 300;
const GUARDRAILS_MAX = 800;

/**
 * Seller-authored positioning (0061): value proposition, brand voice, guardrails. All optional —
 * empty trims to null so the loaders fall back to the website-scan summary / omit the field.
 */
export function validatePositioning(input: {
  valueProp: string;
  brandVoice: string;
  guardrails: string;
}):
  | Valid<{ valueProp: string | null; brandVoice: string | null; guardrails: string | null }>
  | Invalid {
  const valueProp = input.valueProp.trim();
  const brandVoice = input.brandVoice.trim();
  const guardrails = input.guardrails.trim();
  if (valueProp.length > VALUE_PROP_MAX) return { ok: false, error: `Keep your value proposition under ${VALUE_PROP_MAX} characters.` };
  if (brandVoice.length > BRAND_VOICE_MAX) return { ok: false, error: `Keep the brand voice under ${BRAND_VOICE_MAX} characters.` };
  if (guardrails.length > GUARDRAILS_MAX) return { ok: false, error: `Keep guardrails under ${GUARDRAILS_MAX} characters.` };
  return {
    ok: true,
    values: {
      valueProp: valueProp || null,
      brandVoice: brandVoice || null,
      guardrails: guardrails || null,
    },
  };
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
  if (looksLikeUrl(companyName)) {
    return {
      ok: false,
      error: /linkedin\.com/i.test(companyName)
        ? "That's a LinkedIn link — you'll connect LinkedIn right after signup. Enter your company or business name here."
        : "That looks like a link — enter your company or business name (e.g. “Acme Marketing”).",
    };
  }
  return { ok: true, values: { email, password: input.password, companyName } };
}

/** R3: signup via a team invite — the member joins an existing workspace, so there is
 *  no company field; the email must match the one the invite was issued to. */
export function validateMemberSignup(input: {
  email: string;
  password: string;
  inviteEmail: string;
}): Valid<{ email: string; password: string }> | Invalid {
  const email = input.email.trim();
  if (!email || !email.includes("@")) return { ok: false, error: "Enter a valid email address." };
  if (input.password.length < 8) {
    return { ok: false, error: "Password must be at least 8 characters." };
  }
  if (email.toLowerCase() !== input.inviteEmail.trim().toLowerCase()) {
    return {
      ok: false,
      error: `This invite was sent to ${input.inviteEmail} — sign up with that address, or ask for a new invite.`,
    };
  }
  return { ok: true, values: { email, password: input.password } };
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

const FIELD_MAX = 120;

/**
 * R6 manual add-lead: first name + a LinkedIn profile URL are required (LinkedIn is the only
 * outreach channel, so a lead without a profile can never be contacted); everything else is
 * optional context that helps the qualification rank judge fit.
 */
export function validateManualLead(input: {
  firstName: string;
  lastName: string;
  title: string;
  companyName: string;
  linkedinUrl: string;
}):
  | Valid<{
      firstName: string;
      lastName: string | null;
      title: string | null;
      companyName: string | null;
      linkedinUrl: string;
    }>
  | Invalid {
  const firstName = input.firstName.trim();
  if (!firstName) return { ok: false, error: "Enter the prospect's first name." };
  for (const [label, v] of [
    ["First name", firstName],
    ["Last name", input.lastName],
    ["Title", input.title],
    ["Company", input.companyName],
  ] as const) {
    if (v.trim().length > FIELD_MAX) return { ok: false, error: `${label} is too long.` };
  }
  const linkedin = normalizeLinkedinUrl(input.linkedinUrl);
  if (!linkedin.ok) return linkedin;
  if (!linkedin.url || !/linkedin\.com\/in\//i.test(linkedin.url)) {
    return { ok: false, error: "Enter their LinkedIn profile URL (linkedin.com/in/…)." };
  }
  const opt = (v: string) => (v.trim() ? v.trim() : null);
  return {
    ok: true,
    values: {
      firstName,
      lastName: opt(input.lastName),
      title: opt(input.title),
      companyName: opt(input.companyName),
      linkedinUrl: linkedin.url,
    },
  };
}
