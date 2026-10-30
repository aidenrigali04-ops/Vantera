import { reward, rollup, type DecisionOutcome, type PriorTable } from "@vantera/agent-brains";
import type { ConversationLearnStore, ConversationStore } from "./types";

/** A decision is scored once its outcome window (7 days) has closed. */
export const MATURITY_MS = 7 * 86_400_000;
const BATCH = 500;
const ROLLUP_LIMIT = 100_000;

type LearnStore = ConversationStore & ConversationLearnStore;

const ZERO_OUTCOME: DecisionOutcome = {
  replied: false,
  stance: null,
  furtherLeadTurns: 0,
  booked: false,
  optOut: false,
  identitySuspicion: false,
  humanTakeover: false,
  waitThenReply: false,
};

/**
 * Nightly learner (spec §7.3-§7.4): score matured decisions, then rebuild the per-account and
 * global prior rollups from every scored, on-policy decision in the 90-day window.
 */
export async function runConversationLearn(deps: {
  store: LearnStore;
  now: () => Date;
  simPriors?: PriorTable;
}): Promise<{ scored: number; excluded: number; cellsAccount: number; cellsGlobal: number; seededSim: boolean }> {
  const { store } = deps;
  const now = deps.now();
  let scored = 0;
  let excluded = 0;

  const due = await store.listUnscoredDecisions(new Date(now.getTime() - MATURITY_MS), BATCH);
  for (const d of due) {
    // A human edited the composed message: the logged propensity no longer describes what was sent.
    if (d.sentBody !== null && d.composedBody !== null && d.sentBody.trim() !== d.composedBody.trim()) {
      await store.scoreDecision(d.id, { ...ZERO_OUTCOME, offPolicy: true } as DecisionOutcome & { offPolicy: true }, null);
      excluded++;
      continue;
    }
    const outcome = await store.outcomeFor(d);
    await store.scoreDecision(d.id, outcome, reward(outcome, d.move));
    scored++;
  }

  const all = await store.listScoredDecisions(null, ROLLUP_LIMIT);
  const byAccount = new Map<string, typeof all>();
  for (const row of all) {
    const list = byAccount.get(row.accountId) ?? [];
    list.push(row);
    byAccount.set(row.accountId, list);
  }
  let cellsAccount = 0;
  for (const [accountId, rows] of byAccount) {
    const cells = rollup(rows, "real");
    await store.upsertPriors(accountId, cells);
    cellsAccount += cells.length;
  }
  const globalCells = rollup(all, "real");
  if (globalCells.length > 0) await store.upsertPriors(null, globalCells);

  let seededSim = false;
  if (deps.simPriors && deps.simPriors.length > 0 && !(await store.hasGlobalPriors("sim"))) {
    await store.upsertPriors(null, deps.simPriors);
    seededSim = true;
  }
  return { scored, excluded, cellsAccount, cellsGlobal: globalCells.length, seededSim };
}
