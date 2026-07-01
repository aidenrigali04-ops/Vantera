import type { CopyStrategy } from "../copy/shared";
import type { FunnelStageKey } from "./funnel";

/**
 * Experiment domain helpers (Phase 3). Which single copy knob a challenger tests for a diagnosed
 * leak, human labels for the approval UI, and the status vocabulary. Pure.
 */

export type ExperimentStatus = "running" | "ready_to_adopt" | "adopted" | "discarded" | "halted";

/** A running experiment is terminal (needs no further decision) in these states. */
export function isTerminalStatus(status: ExperimentStatus): boolean {
  return status === "adopted" || status === "discarded" || status === "halted";
}

/**
 * The single-variable challenger to test for a leak — always exactly one copy knob changed from the
 * champion. Returns null for `close` (a sales-conversation gap, not a copy lever) so the engine never
 * fabricates a copy test that cannot move the metric.
 */
export function proposeChallengerStrategy(stageKey: FunnelStageKey): CopyStrategy | null {
  switch (stageKey) {
    case "acceptance":
      return { openWith: "trigger" }; // notes that lead with the trigger get accepted more
    case "reply":
      return { followupLength: "tight" }; // tighter follow-ups earn more replies
    case "booking":
      return { askStyle: "specific" }; // a concrete ask converts interest into meetings
    case "close":
    default:
      return null;
  }
}

const KNOB_LABEL: Record<string, string> = {
  "openWith:trigger": "lead with the prospect's trigger",
  "openWith:pain": "lead with the prospect's pain",
  "followupLength:tight": "a tighter, one-sentence follow-up",
  "followupLength:standard": "a standard-length follow-up",
  "askStyle:soft": "a softer, low-pressure ask",
  "askStyle:specific": "a concrete, specific ask",
};

/** Human label for a strategy, for the approval UI. */
export function describeStrategy(strategy: CopyStrategy): string {
  const parts = Object.entries(strategy)
    .filter(([, v]) => v)
    .map(([k, v]) => KNOB_LABEL[`${k}:${String(v)}`] ?? `${k}: ${String(v)}`);
  return parts.length > 0 ? parts.join(", ") : "the current approach";
}
