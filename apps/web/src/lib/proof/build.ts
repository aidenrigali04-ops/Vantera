import { agentRows, leadSets, sourceRows } from "./sources";
import type { ProofInput, ProofModel, ProofStage, ProofStageKey } from "./types";

const QUALIFIED = new Set(["qualified", "enriched", "in_campaign", "replied", "converted"]);
const LABELS: [ProofStageKey, string][] = [
  ["found", "Found"], ["qualified", "Qualified"], ["contacted", "Contacted"],
  ["accepted", "Accepted"], ["replied", "Replied"], ["interested", "Interested"],
  ["meetings", "Meetings"], ["closed", "Closed"],
];

export function buildProof(input: ProofInput): ProofModel {
  const sets = leadSets(input);
  const counts: Record<ProofStageKey, number> = {
    found: input.leads.length,
    qualified: input.leads.filter((l) => QUALIFIED.has(l.status)).length,
    contacted: sets.contacted.size,
    accepted: sets.accepted.size,
    replied: sets.replied.size,
    interested: sets.interested.size,
    meetings: input.leads.filter((l) => l.meeting_booked_at !== null || l.status === "converted").length,
    closed: sets.closed.size,
  };
  const funnel: ProofStage[] = LABELS.map(([key, label], i) => {
    const prev = i === 0 ? null : counts[LABELS[i - 1]![0]];
    const pct = prev === null || prev === 0 ? null : Math.round((counts[key] / prev) * 100);
    return { key, label, count: counts[key], pct };
  });
  const nonMonotonic = funnel.some((s, i) => i > 0 && s.count > funnel[i - 1]!.count);
  return {
    funnel,
    sources: sourceRows(input, sets),
    agents: agentRows(input, sets),
    capped: input.capped,
    nonMonotonic,
  };
}
