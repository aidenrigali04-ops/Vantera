/**
 * The /start journey gate (journey v2, blueprint §4) — a pure sibling of resolveGate
 * (gate.ts stays byte-untouched; the legacy /signup → /onboarding chain keeps working
 * during the strangler window). The wizard never re-asks anything it knows: every
 * surface resolves the FURTHEST incomplete step and fast-forwards.
 */

export type StartStep = "/start" | "/start/business" | "/start/buyers" | "/start/linkedin" | "/reveal";

export type StartContext = {
  isAuthenticated: boolean;
  /** accounts row exists (created at claim via create_account) */
  hasAccount: boolean;
  /** /start/business confirmed: website_url set, or a described offer saved as the scan */
  businessConfirmed: boolean;
  /** an icps row with source='onboarding' exists (the /start/buyers insert) */
  icpConfirmed: boolean;
  /** a linkedin_accounts row in status connecting|active — 'connecting' counts so the
   *  user isn't bounced back in the seconds before the account_status webhook lands */
  linkedinConnected: boolean;
  /** accounts.onboarding_completed_at set — finished users (either flow) never re-enter */
  onboardingComplete: boolean;
};

/** Furthest-incomplete step for the /start journey. */
export function resolveStartStep(ctx: StartContext): StartStep | "/dashboard" {
  if (!ctx.isAuthenticated) return "/start";
  if (ctx.onboardingComplete) return "/dashboard";
  if (!ctx.hasAccount) return "/start";
  if (!ctx.businessConfirmed) return "/start/business";
  if (!ctx.icpConfirmed) return "/start/buyers";
  if (!ctx.linkedinConnected) return "/start/linkedin";
  return "/reveal";
}

/** Per-page gate: null = render this step, else the redirect target. */
export function resolveStartGate(step: StartStep, ctx: StartContext): string | null {
  const dest = resolveStartStep(ctx);
  return dest === step ? null : dest;
}

/** Free-mail domains that never name a company. */
const FREE_MAIL = new Set([
  "gmail.com",
  "googlemail.com",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "yahoo.com",
  "icloud.com",
  "me.com",
  "proton.me",
  "protonmail.com",
  "aol.com",
  "gmx.com",
  "mail.com",
]);

/** Workspace name guessed from the claim email — "jane@acme.io" → "Acme"; free-mail → local part. */
export function guessCompanyName(email: string): string {
  const [local = "", domainRaw = ""] = email.trim().toLowerCase().split("@");
  const domain = domainRaw.split(":")[0] ?? "";
  if (!domain) return "Your workspace";
  const titleCase = (s: string) =>
    s.length === 0 ? s : s[0]!.toUpperCase() + s.slice(1);
  if (FREE_MAIL.has(domain)) {
    const base = local.split(/[.+_-]/)[0] ?? "";
    return base ? titleCase(base) : "Your workspace";
  }
  // strip the TLD and any deep subdomains: "app.acme.co.uk" → "acme"
  const parts = domain.split(".");
  const MULTI_TLD = new Set(["co", "com", "org", "net", "ac", "gov"]);
  let idx = parts.length - 2;
  if (idx > 0 && MULTI_TLD.has(parts[idx]!) && parts[idx + 1]!.length === 2) idx -= 1;
  const core = parts[Math.max(0, idx)] ?? "";
  return core ? titleCase(core) : "Your workspace";
}
