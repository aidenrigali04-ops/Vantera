import { PLAN_DISPLAY, PLAN_DISPLAY_ORDER, annualMonthlyUsd, annualYearlyUsd, breakEvenCloses, TRIAL_DAYS } from "@vantera/billing";

/**
 * The facts every subscription design shows, derived once (never typed into a component).
 *
 * The product sells ONE self-serve plan (`PLAN_DISPLAY_ORDER` is a single tier since the
 * 2026-07-15 restructure), so this step is not a plan comparison — it is a single decision:
 * start the trial or don't. What converts a one-option paywall is not a decoy tier; it is
 * (1) making "$0 today" unmissable, (2) naming the exact date money moves, and (3) putting
 * the escape hatch next to the button instead of in the footer.
 */

export type Interval = "month" | "year";

export interface PlanFacts {
  tier: string;
  name: string;
  tagline: string;
  features: string[];
  monthlyUsd: number;
  /** effective per-month price when billed annually */
  annualMonthlyUsd: number;
  /** the single annual charge */
  annualYearlyUsd: number;
  /** months free on annual — the honest saving, not a percentage */
  monthsFree: number;
  trialDays: number;
}

export function planFacts(): PlanFacts {
  const tier = PLAN_DISPLAY_ORDER[0] ?? "growth";
  const d = PLAN_DISPLAY[tier];
  return {
    tier,
    name: d.name,
    tagline: d.tagline,
    features: d.features,
    monthlyUsd: d.monthlyUsd,
    annualMonthlyUsd: annualMonthlyUsd(d.monthlyUsd),
    annualYearlyUsd: annualYearlyUsd(d.monthlyUsd),
    monthsFree: 12 - Math.round(annualYearlyUsd(d.monthlyUsd) / d.monthlyUsd),
    trialDays: TRIAL_DAYS,
  };
}

/** What the card is actually charged, and when — the two numbers that decide a paywall. */
export interface ChargeFacts {
  /** always 0 on a card-required trial — stated, never implied */
  todayUsd: number;
  /** the first real charge */
  thenUsd: number;
  /** "/mo" or "/yr" */
  thenUnit: string;
  /** `Aug 29` — the date the trial converts */
  firstChargeLabel: string;
  /** `Aug 28` — the last day to cancel free */
  cancelByLabel: string;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** `Aug 29` in the viewer's own calendar — the date is the promise, so it must be exact. */
export function fmtChargeDate(d: Date): string {
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

export function chargeFacts(plan: PlanFacts, interval: Interval, now: Date): ChargeFacts {
  const first = new Date(now.getTime() + plan.trialDays * 86_400_000);
  const cancelBy = new Date(first.getTime() - 86_400_000);
  return {
    todayUsd: 0,
    thenUsd: interval === "year" ? plan.annualYearlyUsd : plan.monthlyUsd,
    thenUnit: interval === "year" ? "/yr" : "/mo",
    firstChargeLabel: fmtChargeDate(first),
    cancelByLabel: fmtChargeDate(cancelBy),
  };
}

/**
 * "One closed client covers 11 months" — the price anchored against an OUTCOME rather than
 * against another plan (there is no other plan). Null when we don't know what a client is
 * worth: an invented payback number is worse than none.
 */
export function paybackLine(plan: PlanFacts, interval: Interval, dealValueUsd: number | null): string | null {
  if (!dealValueUsd || dealValueUsd <= 0) return null;
  const closes = breakEvenCloses(plan.monthlyUsd, dealValueUsd, interval);
  if (closes == null) return null;
  if (closes > 1) return `${closes} closed clients cover the year.`;
  // One client is enough. Say it in the unit the user is actually buying — quoting a
  // month count next to an annual price reads as sleight of hand.
  if (interval === "year") return "One closed client covers the whole year.";
  const months = Math.floor(dealValueUsd / plan.monthlyUsd);
  if (months >= 24) return "One closed client covers you for two years.";
  if (months >= 12) return `One closed client covers ${months} months.`;
  return "One closed client covers the year.";
}

/** `$1,204` / `$79` — money is always whole dollars here; cents would read as a bill, not a price. */
export function usd(n: number): string {
  return `$${n.toLocaleString("en-US")}`;
}
