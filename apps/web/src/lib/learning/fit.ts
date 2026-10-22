/** ML-4 fit feedback — the user's "Good fit" / "Not a fit" verdict on a prospect. Pure. */

export type FitVerdict = "good_fit" | "not_fit";

export function parseFitVerdict(raw: FormDataEntryValue | null): FitVerdict | "clear" | null {
  return raw === "good_fit" || raw === "not_fit" || raw === "clear" ? raw : null;
}

/** lead_feedback rows → lead id → verdict (unknown values dropped; a failed read is just empty). */
export function fitVerdictFromRows(rows: { lead_id: string; verdict: string }[] | null): Map<string, FitVerdict> {
  const m = new Map<string, FitVerdict>();
  for (const r of rows ?? []) if (r.verdict === "good_fit" || r.verdict === "not_fit") m.set(r.lead_id, r.verdict);
  return m;
}
