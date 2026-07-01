/**
 * Deterministic variant allocation for a running experiment (Phase 3).
 *
 * A lead's arm is a stable hash of (experimentId, leadId), so the same lead always lands in the same
 * arm for the life of the experiment — no per-touch flip-flopping (which would corrupt attribution),
 * and the split is exactly measurable. Pure, no deps.
 */

export type Variant = "champion" | "challenger";

export type ExperimentAllocation = {
  id: string;
  /** 0–100: share of leads routed to the challenger arm */
  allocationPct: number;
};

/** FNV-1a 32-bit — stable, well-distributed, dependency-free. */
function hash32(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Stable 0–99 bucket for an (experiment, lead) pair. */
export function leadBucket(experimentId: string, leadId: string): number {
  return hash32(`${experimentId}:${leadId}`) % 100;
}

function clampPct(x: number): number {
  if (!Number.isFinite(x)) return 0;
  return x < 0 ? 0 : x > 100 ? 100 : Math.round(x);
}

/** Assign a lead to champion or challenger — deterministic and stable across calls. */
export function assignVariant(experiment: ExperimentAllocation, leadId: string): Variant {
  const pct = clampPct(experiment.allocationPct);
  if (pct <= 0) return "champion";
  if (pct >= 100) return "challenger";
  return leadBucket(experiment.id, leadId) < pct ? "challenger" : "champion";
}
