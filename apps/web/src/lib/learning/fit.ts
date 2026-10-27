/** ML-4 fit feedback — the user's "Good fit" / "Not a fit" verdict on a prospect. Pure. */

export type FitVerdict = "good_fit" | "not_fit";

export function parseFitVerdict(raw: FormDataEntryValue | null): FitVerdict | "clear" | null {
  return raw === "good_fit" || raw === "not_fit" || raw === "clear" ? raw : null;
}

/** The optional "why not a fit" note — trimmed; blank/absent → null (omitted); over 200 chars → invalid
 *  (lead_feedback.reason has a 1..200 check, so the action rejects rather than truncating). */
export const FIT_REASON_MAX = 200;
export function parseFitReason(raw: FormDataEntryValue | null): { ok: true; reason: string | null } | { ok: false } {
  const text = typeof raw === "string" ? raw.trim() : "";
  if (!text) return { ok: true, reason: null };
  if (text.length > FIT_REASON_MAX) return { ok: false };
  return { ok: true, reason: text };
}

/** The Fit control's lifecycle after a save: the shown reason and a closed input follow only a
 *  confirmed save; a failed one keeps the old reason and leaves the input (and its text) open. */
export function fitAfterSave(
  prevReason: string | null,
  verdict: FormDataEntryValue | null,
  reasonRaw: FormDataEntryValue | null,
  ok: boolean
): { reason: string | null; closeInput: boolean } {
  if (!ok) return { reason: prevReason, closeInput: false };
  if (verdict === "not_fit") {
    const parsed = parseFitReason(reasonRaw);
    return { reason: parsed.ok ? parsed.reason : null, closeInput: true };
  }
  if (verdict === "clear") return { reason: null, closeInput: true };
  return { reason: prevReason, closeInput: true };
}

/** lead_feedback rows → lead id → verdict (unknown values dropped; a failed read is just empty). */
export function fitVerdictFromRows(rows: { lead_id: string; verdict: string }[] | null): Map<string, FitVerdict> {
  const m = new Map<string, FitVerdict>();
  for (const r of rows ?? []) if (r.verdict === "good_fit" || r.verdict === "not_fit") m.set(r.lead_id, r.verdict);
  return m;
}
