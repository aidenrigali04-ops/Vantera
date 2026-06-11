export type Valid<T> = { ok: true; values: T };
export type Invalid = { ok: false; error: string };

export function dollarsToCents(input: string): number | null {
  const cleaned = input.replace(/[$,\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const cents = Math.round(parseFloat(cleaned) * 100);
  return cents > 0 ? cents : null;
}

export function validateOnboarding(input: {
  industry: string;
  icp: string;
  revenueGoal: string;
}): Valid<{ industry: string; icp: string; revenueGoalCents: number }> | Invalid {
  const industry = input.industry.trim();
  const icp = input.icp.trim();
  if (!industry) return { ok: false, error: "Enter your industry." };
  if (!icp) return { ok: false, error: "Describe your ICP (ideal customer profile)." };
  const revenueGoalCents = dollarsToCents(input.revenueGoal);
  if (revenueGoalCents === null) {
    return { ok: false, error: "Enter a monthly revenue goal greater than zero." };
  }
  return { ok: true, values: { industry, icp, revenueGoalCents } };
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
}): Valid<{ name: string; industry: string; icp: string; revenueGoalCents: number }> | Invalid {
  const name = input.name.trim();
  if (!name) return { ok: false, error: "Workspace name can't be empty." };
  const onboarding = validateOnboarding(input);
  if (!onboarding.ok) return onboarding;
  return { ok: true, values: { name, ...onboarding.values } };
}

export function confirmAccountName(accountName: string, typed: string): boolean {
  return typed.trim() === accountName;
}
