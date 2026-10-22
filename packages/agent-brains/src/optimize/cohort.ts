import type { FunnelCohort } from "../research/calibrate";
import type { FunnelStageKey } from "./funnel";
import { aggregateArm, type LeadOutcomeFlags } from "./outcomes";
import type { VariantOutcome } from "./decide";

/**
 * One genome per arena. An empty object is the account default: the product has not
 * recorded a full-funnel strategy for this lead yet. A copy-recipe playbook is not a genome.
 */
export type StrategyGenome = Record<string, Record<string, string>>;

export type StrategySource = "hive" | "experiment" | "manual" | "default";

export type StampArm = "champion" | "challenger" | null;

/** One sourced lead, already reduced to flags. `arm` is null when the stamp is observational. */
export type CohortLead = {
  id: string;
  sourced: boolean;
  qualified: boolean;
  invited: boolean;
  accepted: boolean;
  interested: boolean;
  negative: boolean;
  booked: boolean;
  closed: boolean;
  arm: StampArm;
};

const EMPTY_ARM: VariantOutcome = { denominator: 0, successes: 0, negatives: 0 };

/** Stable per-account dedupe key. Key order does not matter. The empty genome is "default". */
export function genomeSignature(genome: StrategyGenome): string {
  const arenas = Object.keys(genome).sort();
  if (arenas.length === 0) return "default";
  return arenas
    .map((arena) => {
      const genes = genome[arena] ?? {};
      const parts = Object.keys(genes)
        .sort()
        .map((gene) => `${gene}=${genes[gene] ?? ""}`);
      return `${arena}:${parts.join(",")}`;
    })
    .join("|");
}

/** Accept a stored jsonb value only when it is a nested arena genome. Flat copy recipes return {}. */
export function asStrategyGenome(value: unknown): StrategyGenome {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: StrategyGenome = {};
  for (const [arena, genes] of Object.entries(value as Record<string, unknown>)) {
    if (!genes || typeof genes !== "object" || Array.isArray(genes)) continue;
    const row: Record<string, string> = {};
    for (const [gene, geneValue] of Object.entries(genes as Record<string, unknown>)) {
      if (typeof geneValue === "string" && geneValue.length > 0) row[gene] = geneValue;
    }
    if (Object.keys(row).length > 0) out[arena] = row;
  }
  return out;
}

export function rollupCohort(leads: CohortLead[]): FunnelCohort {
  const cohort: FunnelCohort = {
    sourced: 0,
    qualified: 0,
    invited: 0,
    accepted: 0,
    interested: 0,
    negative: 0,
    booked: 0,
    closed: 0,
  };
  for (const lead of leads) {
    if (lead.sourced) cohort.sourced++;
    if (lead.qualified) cohort.qualified++;
    if (lead.invited) cohort.invited++;
    if (lead.accepted) cohort.accepted++;
    if (lead.interested) cohort.interested++;
    if (lead.negative) cohort.negative++;
    if (lead.booked) cohort.booked++;
    if (lead.closed) cohort.closed++;
  }
  return cohort;
}

/** Randomized arms only. A null arm is observational and cannot enter a causal rollup. */
export function rollupArms(
  stage: FunnelStageKey,
  leads: CohortLead[]
): Record<"champion" | "challenger", VariantOutcome> {
  const champion = leads.filter((lead) => lead.arm === "champion").map(toFlags);
  const challenger = leads.filter((lead) => lead.arm === "challenger").map(toFlags);
  return {
    champion: champion.length ? aggregateArm(stage, champion) : { ...EMPTY_ARM },
    challenger: challenger.length ? aggregateArm(stage, challenger) : { ...EMPTY_ARM },
  };
}

export function replyPolarity(classifications: Iterable<string>): { interested: boolean; negative: boolean } {
  let interested = false;
  let negative = false;
  for (const classification of classifications) {
    if (classification === "interested") interested = true;
    if (classification === "not_interested" || classification === "unsubscribe") negative = true;
  }
  return { interested, negative };
}

function toFlags(lead: CohortLead): LeadOutcomeFlags {
  return {
    invited: lead.invited,
    accepted: lead.accepted,
    interested: lead.interested,
    negative: lead.negative,
    booked: lead.booked,
    converted: lead.closed,
  };
}
