import {
  explainLead,
  featureLabel,
  LEARN_MIN_N,
  type LeadReason,
  type LearnedReadout,
  type ReadoutFeature,
} from "@vantera/agent-brains";

/**
 * ML-2 visible learning: the scout run summary carries the account's learned readout (built from
 * this account's OWN outcomes only — never the cross-account pool). These helpers turn it into
 * per-prospect reasons and the Prospects "What's working" strip. Pure.
 */

const isFeature = (f: unknown): f is ReadoutFeature => {
  const x = f as ReadoutFeature;
  return (
    !!x &&
    typeof x.feature === "string" &&
    x.feature.includes(":") &&
    typeof x.lift === "number" &&
    typeof x.ratio === "number" &&
    typeof x.n === "number"
  );
};

/** The readout from a scout run's `summary` jsonb, or null if absent/malformed. */
export function parseReadout(summary: unknown): LearnedReadout | null {
  const learned = (summary as { learned?: unknown } | null)?.learned as
    | { evidence?: unknown; features?: unknown }
    | null
    | undefined;
  if (!learned || typeof learned.evidence !== "number" || !Array.isArray(learned.features)) return null;
  return { evidence: learned.evidence, features: learned.features.filter(isFeature) };
}

/** The prospect-row fields the learner reads. */
export type ReasonLead = {
  source?: string | null;
  title: string | null;
  industry: string | null;
  company_size?: string | null;
  ai_score: number | null;
  lead_signals?: { kind: string; level?: string | null }[] | null;
};

export function reasonsForLead(readout: LearnedReadout | null, lead: ReasonLead): LeadReason[] {
  if (!readout) return [];
  const signals = lead.lead_signals ?? [];
  return explainLead(readout, {
    source: lead.source,
    title: lead.title,
    industry: lead.industry,
    companySize: lead.company_size,
    aiScore: lead.ai_score,
    signals: signals.map((s) => s.kind),
    intentLevel: signals.find((s) => s.kind === "intent")?.level ?? null,
  });
}

export type WhatsWorking = {
  evidence: number;
  up: { label: string; ratio: number }[];
  down: { label: string; ratio: number }[];
};

/** Top 3 features replying more and less than the account's average — null until it means something. */
export function whatsWorking(readout: LearnedReadout | null): WhatsWorking | null {
  if (!readout || readout.evidence < LEARN_MIN_N) return null;
  const toRow = (f: ReadoutFeature) => ({ label: featureLabel(f.feature), ratio: f.ratio });
  const up = readout.features.filter((f) => f.lift > 0).sort((a, b) => b.lift - a.lift).slice(0, 3).map(toRow);
  const down = readout.features.filter((f) => f.lift < 0).sort((a, b) => a.lift - b.lift).slice(0, 3).map(toRow);
  if (up.length === 0 && down.length === 0) return null;
  return { evidence: readout.evidence, up, down };
}
