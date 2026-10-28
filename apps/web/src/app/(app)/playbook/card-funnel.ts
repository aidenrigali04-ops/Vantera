import type { ProofModel, ProofRow } from "@/lib/proof/types";

/** One step of a Playbook card's mini funnel; pct is vs the previous stage (null when it is 0). */
export type MiniStage = { label: string; count: number; pct: number | null };

/**
 * The latest completed intent run. `intentRan` is whether such a run exists at all;
 * `intentSummary` is its `agent_runs.summary`, which can be null even on a completed run.
 */
export type RunFacts = {
  intentSummary: { observed?: number; intent?: number; qualified?: number } | null;
  intentRan: boolean;
};

export type CardFunnels = {
  scout: MiniStage[];
  intent: MiniStage[];
  copy: MiniStage[];
  /** false = no completed intent run yet; a completed run with no summary still counts */
  intentRan: boolean;
  /** visible line above each funnel saying what it counts (null = none) */
  captions: { scout: string; intent: string; copy: null };
};

/** What each card funnel counts, so it never reads as the stat beside it. */
export const FUNNEL_CAPTION = {
  scout: "Prospects this agent found",
  intent: "Last run",
} as const;

/** Empty-state lines under a mini funnel whose stages are all zero. */
export const FUNNEL_EMPTY = {
  scout: "No prospects found yet",
  intentNoRun: "No run yet",
  intentNothing: "Last run found nothing",
  copy: "Nothing sent yet",
} as const;

export function funnelEmpty(kind: "scout" | "intent" | "copy", funnels: Pick<CardFunnels, "intentRan">): string {
  if (kind === "intent") return funnels.intentRan ? FUNNEL_EMPTY.intentNothing : FUNNEL_EMPTY.intentNoRun;
  return FUNNEL_EMPTY[kind];
}

const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);

function chain(steps: [label: string, count: number][]): MiniStage[] {
  return steps.map(([label, count], i) => {
    const prev = i === 0 ? null : steps[i - 1][1];
    return { label, count, pct: prev === null || prev === 0 ? null : Math.round((count / prev) * 100) };
  });
}

/**
 * Per-agent mini funnels for the Playbook cards. Every stage is per-agent and honest:
 * Scout reads its own attribution row (found → contacted → replied), Outreach reads the
 * outreach row, and Intent reads the latest run's own summary — the account-wide
 * "qualified" stage is never passed off as one agent's work.
 */
export function cardFunnels(proof: ProofModel, runs: RunFacts): CardFunnels {
  const row = (key: string): ProofRow | undefined => proof.agents.find((r) => r.key === key);
  const scout = row("agent:scout");
  const out = row("agent:outreach");
  const s = runs.intentSummary;
  return {
    scout: chain([
      ["Found", num(scout?.found)],
      ["Contacted", num(scout?.contacted)],
      ["Replied", num(scout?.replied)],
    ]),
    intent: chain([
      ["Observed", num(s?.observed)],
      ["Intent", num(s?.intent)],
      ["Qualified", num(s?.qualified)],
    ]),
    copy: chain([
      ["Contacted", num(out?.contacted)],
      ["Accepted", num(out?.accepted)],
      ["Replied", num(out?.replied)],
      ["Interested", num(out?.interested)],
    ]),
    intentRan: runs.intentRan,
    captions: { scout: FUNNEL_CAPTION.scout, intent: FUNNEL_CAPTION.intent, copy: null },
  };
}
