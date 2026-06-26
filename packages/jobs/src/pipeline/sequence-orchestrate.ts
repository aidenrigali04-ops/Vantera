import { advanceSequence } from "./sequence-advance";
import type {
  DueSequenceRun,
  SequenceRun,
  SequenceStore,
  SequenceTickContext,
  SequenceTouchDispatch,
} from "./types";

/** Subset of the store the orchestration loop needs (createPgStore satisfies it). */
export type OrchestrateStore = SequenceStore;

/** Side-effecting task dispatch, injected so the core stays runtime-agnostic (no Trigger import). */
export interface OrchestrateDispatch {
  dispatchTouch(payload: SequenceTouchDispatch): Promise<void>;
}

export interface OrchestrateEnv {
  store: OrchestrateStore;
  dispatch: OrchestrateDispatch;
  killSwitch: boolean;
  /** pre-fetched once per tick (batched), so driving a run never issues its own suppression query */
  suppressed: { linkedin: boolean };
  now: Date;
}

/**
 * Drive one due run through advanceSequence, applying advances in-tick until it dispatches a
 * touch, archives an exhausted lead, or holds. Optimistic claim guards against a racing tick.
 * Caller stage routes through call-brief with the account's live caller agent; no live caller
 * agent => not dispatchable, stop gracefully. The orchestrator owns the x2 cadence via
 * run.callAttempts (one brief per attempt).
 */
export async function driveSequenceRun(
  item: DueSequenceRun,
  env: OrchestrateEnv
): Promise<{ dispatched: number; archived: number }> {
  let run: SequenceRun = item.run;
  const suppressed = env.suppressed;

  // bounded loop: at most one transition per stage in a single tick
  for (let i = 0; i <= item.config.order.length + 1; i++) {
    const ctx: SequenceTickContext = {
      run,
      config: item.config,
      channels: item.channels,
      suppressed,
      accountPaused: item.accountPaused,
      killSwitch: env.killSwitch,
      now: env.now,
    };
    const decision = advanceSequence(ctx);
    if (decision.kind === "hold") return { dispatched: 0, archived: 0 };

    // optimistic claim; if another tick already moved this run, stop
    const claimed = await env.store.applyRunPatch(run.id, run.nextActionAt, decision.patch);
    if (!claimed) return { dispatched: 0, archived: 0 };

    if (decision.kind === "dispatch") {
      await env.dispatch.dispatchTouch({
        runId: run.id,
        accountId: run.accountId,
        campaignId: run.campaignId,
        leadId: run.leadId,
        stage: decision.stage,
        touchNo: decision.touchNo,
      });
      return { dispatched: 1, archived: 0 };
    }

    if (decision.kind === "exhaust") {
      await env.store.archiveLead(run.leadId, run.campaignId);
      return { dispatched: 0, archived: 1 };
    }

    // advance: apply the patch locally and loop (may dispatch the next stage this tick)
    run = { ...run, ...decision.patch };
  }
  return { dispatched: 0, archived: 0 };
}

const BATCH = 200;

/**
 * One orchestrator tick: enroll pending leads, scan due active runs, drive each. The cron task
 * is a thin wrapper that injects the real store + Trigger dispatch.
 */
export async function runSequenceTick(env: {
  store: OrchestrateStore;
  dispatch: OrchestrateDispatch;
  now: Date;
}): Promise<{ enrolled: number; due: number; dispatched: number; archived: number }> {
  const enrolled = await env.store.enrollPendingLeads(env.now);
  const killSwitch = await env.store.isKillSwitchOn();
  const due = await env.store.getDueSequenceRuns(env.now, BATCH);
  // Batched suppression: one indexed query per account for the whole tick, not one per run.
  const suppressedByRun = await env.store.suppressionFlagsForRuns(due);

  let dispatched = 0;
  let archived = 0;
  for (const item of due) {
    const acted = await driveSequenceRun(item, {
      store: env.store,
      dispatch: env.dispatch,
      killSwitch,
      suppressed: suppressedByRun.get(item.run.id) ?? { linkedin: false },
      now: env.now,
    });
    dispatched += acted.dispatched;
    archived += acted.archived;
  }
  return { enrolled, due: due.length, dispatched, archived };
}
