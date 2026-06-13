import type { PurgeCandidate, RetentionDeps, RetentionSummary } from "./types";

/** retention(leads), 0002: prospects with rules_gate_passed = false or never scored purge after 90 days */
export const RETENTION_DAYS = 90;

/** retention(webhook_events), 0009: debugging/idempotency rows purge after 30 days (rule 11) */
export const WEBHOOK_RETENTION_DAYS = 30;

/**
 * Safety predicate — the deciding logic lives HERE, tested, not in SQL.
 * Anything that ever qualified (or is still awaiting scoring after passing
 * the gate) is kept; only gate-failed or never-scored prospects purge.
 */
export function isPurgeable(lead: PurgeCandidate): boolean {
  if (lead.status !== "sourced" && lead.status !== "rejected") return false;
  if (lead.rulesGatePassed === false) return true;
  return lead.rulesGatePassed === null && lead.scoredAt === null;
}

export async function runRetentionPurge(deps: RetentionDeps): Promise<RetentionSummary> {
  const now = deps.now ? deps.now() : new Date();
  const cutoff = new Date(now.getTime() - RETENTION_DAYS * 86_400_000);
  const candidates = await deps.store.getPurgeCandidates(cutoff);
  const ids = candidates.filter(isPurgeable).map((l) => l.id);
  const purged = ids.length > 0 ? await deps.store.deleteLeads(ids) : 0;
  const webhookCutoff = new Date(now.getTime() - WEBHOOK_RETENTION_DAYS * 86_400_000);
  const webhookEventsPurged = await deps.store.purgeWebhookEvents(webhookCutoff);
  return { status: "completed", purged, cutoff: cutoff.toISOString(), webhookEventsPurged };
}
