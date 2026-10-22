/**
 * Pure shaping for /api/reveal/status — the Reveal's poll feed. The two pre-payment
 * rules live HERE, unit-tested, not scattered in the route:
 *   1. at most REVEAL_SURFACED_CAP matches are surfaced (identities/scores fully shown);
 *   2. exactly ONE draft body ever leaves the endpoint (the top-scored invite) —
 *      matches carry no bodies (blueprint §6.4: the lock is on depth, never on truth).
 */

export const REVEAL_SURFACED_CAP = 15;

export type RevealRunRow = {
  status: "queued" | "scanning" | "ranking" | "drafting" | "done" | "failed";
  scanned: number;
  gate_passed: number;
  matched: number;
  drafted: number;
  error: string | null;
};

export type RevealMatchRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  title: string | null;
  company_name: string | null;
  ai_score: number | null;
  ai_rationale: string | null;
  ai_insights: { summary?: string } | null;
};

export type RevealDraftRow = { lead_id: string; body: string | null } | null;

/** Error codes a client may see — anything else (raw provider/DB/SDK strings) is clamped. */
const CLIENT_ERROR_WHITELIST = new Set(["no_icp"]);

/** Clamp the persisted error across the trust boundary (rules 03/04/05): the ledger may
    hold raw diagnostics for ops, but the browser only ever sees a whitelisted code. */
export function clampClientError(error: string | null): string | null {
  if (!error) return null;
  return CLIENT_ERROR_WHITELIST.has(error) ? error : "internal";
}

export type RevealStatus =
  | { status: "not_started" }
  | {
      status: RevealRunRow["status"];
      scanned: number;
      /** matched clamped to the surfaced cap — display honesty: what you see is what we claim */
      matched: number;
      drafted: number;
      error: string | null;
      matches: {
        leadId: string;
        name: string;
        title: string | null;
        company: string | null;
        score: number;
        evidenceLine: string | null;
      }[];
      topDraft: { leadId: string; body: string } | null;
    };

function evidenceLine(row: RevealMatchRow): string | null {
  const summary = row.ai_insights?.summary?.trim();
  if (summary) return summary;
  const rationale = row.ai_rationale?.trim();
  if (!rationale) return null;
  // first sentence, bounded
  const first = rationale.split(/(?<=[.!?])\s/)[0] ?? rationale;
  return first.length > 140 ? `${first.slice(0, 139)}…` : first;
}

export function buildRevealStatus(
  run: RevealRunRow | null,
  matchRows: RevealMatchRow[],
  draftRow: RevealDraftRow
): RevealStatus {
  if (!run) return { status: "not_started" };

  const matches = matchRows
    .filter((m) => m.ai_score != null)
    .sort((a, b) => (b.ai_score ?? 0) - (a.ai_score ?? 0))
    .slice(0, REVEAL_SURFACED_CAP)
    .map((m) => ({
      leadId: m.id,
      name: [m.first_name, m.last_name].filter(Boolean).join(" ") || "Unnamed prospect",
      title: m.title,
      company: m.company_name,
      score: m.ai_score ?? 0,
      evidenceLine: evidenceLine(m),
    }));

  const topDraft =
    draftRow && draftRow.body ? { leadId: draftRow.lead_id, body: draftRow.body } : null;

  return {
    status: run.status,
    scanned: run.scanned,
    matched: Math.min(run.matched, REVEAL_SURFACED_CAP),
    drafted: run.drafted,
    error: clampClientError(run.error),
    matches,
    topDraft,
  };
}
