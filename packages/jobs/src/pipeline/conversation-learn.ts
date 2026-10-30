import { reward, rollup, type DecisionOutcome, type PriorTable } from "@vantera/agent-brains";
import type { ConversationLearnStore, ConversationStore } from "./types";

/** A decision is scored once its outcome window (7 days) has closed. */
export const MATURITY_MS = 7 * 86_400_000;
const BATCH = 500;
const ROLLUP_LIMIT = 100_000;
const ROLLUP_WINDOW_MS = 90 * 86_400_000;
const IN_FLIGHT = new Set(["pending_review", "approved", "scheduled", "sending"]);

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
  warn?: (msg: string, ctx?: Record<string, unknown>) => void;
}): Promise<{
  scored: number;
  excluded: number;
  deferred: number;
  failed: number;
  cellsAccount: number;
  cellsGlobal: number;
  seededSim: boolean;
}> {
  const { store } = deps;
  const now = deps.now();
  let scored = 0;
  let excluded = 0;
  let deferred = 0;
  let failed = 0;

  const due = await store.listUnscoredDecisions(new Date(now.getTime() - MATURITY_MS), BATCH);
  for (const d of due) {
    try {
      // A human edited the composed message: the logged propensity no longer describes what was sent.
      if (d.sentBody !== null && d.composedBody !== null && d.sentBody.trim() !== d.composedBody.trim()) {
        await store.scoreDecision(d.id, { ...ZERO_OUTCOME, offPolicy: true } as DecisionOutcome & { offPolicy: true }, null);
        excluded++;
        continue;
      }
      // Never delivered: not evidence about the move. Still in flight => wait; dead => exclude.
      if (d.move !== "wait" && d.sentAt === null) {
        if (d.sendStatus !== null && IN_FLIGHT.has(d.sendStatus)) {
          deferred++;
        } else {
          await store.scoreDecision(d.id, { ...ZERO_OUTCOME, unsent: true } as DecisionOutcome & { unsent: true }, null);
          excluded++;
        }
        continue;
      }
      const outcome = await store.outcomeFor(d);
      await store.scoreDecision(d.id, outcome, reward(outcome, d.move));
      scored++;
    } catch (err) {
      failed++;
      deps.warn?.("conversation learn: decision failed", { id: d.id, error: String(err) });
    }
  }

  // Seed BEFORE the real global replace: a global upsert clears 'real' rows, then real is rewritten below.
  let seededSim = false;
  if (deps.simPriors && deps.simPriors.length > 0 && !(await store.hasGlobalPriors("sim"))) {
    await store.upsertPriors(null, deps.simPriors);
    seededSim = true;
  }
  const since = new Date(now.getTime() - ROLLUP_WINDOW_MS);
  const all = await store.listScoredDecisions(null, ROLLUP_LIMIT, since);
  if (all.length >= ROLLUP_LIMIT) deps.warn?.("conversation learn: rollup limit hit; oldest decisions dropped", { limit: ROLLUP_LIMIT });
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
  // an empty rollup still clears stale global 'real' cells
  const globalCells = rollup(all, "real");
  await store.upsertPriors(null, globalCells);

  return { scored, excluded, deferred, failed, cellsAccount, cellsGlobal: globalCells.length, seededSim };
}
