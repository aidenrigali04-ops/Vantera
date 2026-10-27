/**
 * The Today deal-size ask's input rule: whole dollars, `$` and commas allowed,
 * 1 … 10,000,000. Returns cents for `accounts.avg_deal_value_cents`.
 */
export const MAX_DEAL_DOLLARS = 10_000_000;

export type DealValueResult = { ok: true; cents: number } | { ok: false; message: string };

export function parseDealValue(raw: string): DealValueResult {
  const cleaned = raw.trim().replace(/[$,\s]/g, "");
  if (!/^\d+$/.test(cleaned)) return { ok: false, message: "Enter a dollar amount." };
  const dollars = Number(cleaned);
  if (!Number.isSafeInteger(dollars) || dollars < 1) return { ok: false, message: "Enter a dollar amount." };
  if (dollars > MAX_DEAL_DOLLARS) return { ok: false, message: "Keep it under $10,000,000." };
  return { ok: true, cents: dollars * 100 };
}
