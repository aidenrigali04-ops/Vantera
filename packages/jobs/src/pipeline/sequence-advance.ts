import type {
  LeadChannels, SequenceConfig, SequenceCursor, SequenceDecision, SequenceStage,
  SequenceTickContext,
} from "./types";

const DAY = 86_400_000;

/** One-shot soft-no revival (0044): a run exhausting on a lead who DID reply parks for this
 *  long, then gets exactly one more thread-aware touch. "Not right now" is a timing objection,
 *  not a no — but only once, and never for leads who never engaged. */
export const SOFT_NO_REVIVAL_DAYS = 30;

/** An invite still unaccepted this long after it went out ends the run (the dispatcher cancels an
 *  unaccepted follow-up at 30 days; the run gives up first). */
export const INVITE_ACCEPT_TIMEOUT_DAYS = 21;
/** A run whose invite never went out (failed, or never released) ends after this long. */
export const NEVER_INVITED_TIMEOUT_DAYS = 30;
/** How often a run waiting on its connection is re-checked. */
const CONNECTION_RECHECK_DAYS = 1;

function hasIdentifier(_stage: SequenceStage, ch: LeadChannels): boolean {
  return !!ch.linkedinUrl;
}

function isSuppressed(_stage: SequenceStage, s: SequenceTickContext["suppressed"]): boolean {
  return s.linkedin;
}

function stageUsable(stage: SequenceStage, ctx: SequenceTickContext): boolean {
  return ctx.config.stages[stage].enabled && hasIdentifier(stage, ctx.channels) && !isSuppressed(stage, ctx.suppressed);
}

function stageTarget(stage: SequenceStage, config: SequenceConfig): number {
  return config.stages[stage].touches;
}

/** First usable stage strictly after `current` in the configured order, or null. */
function nextUsableStage(current: SequenceCursor, ctx: SequenceTickContext): SequenceStage | null {
  const order = ctx.config.order;
  const start = current === "done" ? order.length : order.indexOf(current) + 1;
  for (let i = start; i < order.length; i++) {
    const stage = order[i]!;
    if (stageUsable(stage, ctx)) return stage;
  }
  return null;
}

function advanceOrExhaust(ctx: SequenceTickContext): SequenceDecision {
  const next = nextUsableStage(ctx.run.currentStage, ctx);
  if (!next) {
    return { kind: "exhaust", patch: { status: "exhausted", currentStage: "done" } };
  }
  return {
    kind: "advance",
    patch: { currentStage: next, touchesDone: 0, enteredStageAt: ctx.now, nextActionAt: ctx.now },
  };
}

/**
 * LinkedIn follow-ups only reach a connection, so the run's clock is the CONNECTION, not the
 * draft. Before acceptance the run waits without spending touches (and gives up after the
 * timeouts); on first sight of an acceptance the clock restarts there — the invite pair's own
 * follow-up is touch 1, released by the dispatcher on acceptance. Null = no gating applies.
 */
function connectionGate(ctx: SequenceTickContext): SequenceDecision | null {
  const { invitedAt, connectedAt } = ctx.connection;
  const now = ctx.now.getTime();
  if (!connectedAt) {
    const timedOut = invitedAt
      ? now - invitedAt.getTime() > INVITE_ACCEPT_TIMEOUT_DAYS * DAY
      : now - ctx.run.enteredStageAt.getTime() > NEVER_INVITED_TIMEOUT_DAYS * DAY;
    if (timedOut) return { kind: "exhaust", patch: { status: "exhausted", currentStage: "done" } };
    return { kind: "wait", patch: { nextActionAt: new Date(now + CONNECTION_RECHECK_DAYS * DAY) } };
  }
  // Reset only when no touch happened since acceptance — a run whose touch already went out
  // after the accept is mid-sequence and keeps its count (rewinding it re-sends a nudge).
  const touchedSinceAccept = ctx.run.lastTouchAt !== null && ctx.run.lastTouchAt.getTime() >= connectedAt.getTime();
  if (!touchedSinceAccept && ctx.run.enteredStageAt.getTime() < connectedAt.getTime()) {
    const cfg = ctx.config.stages.linkedin;
    const gapDays = cfg.touches > 1 ? cfg.touchGapDays : cfg.waitDays;
    return {
      kind: "wait",
      patch: {
        touchesDone: 1,
        enteredStageAt: connectedAt,
        lastTouchAt: connectedAt,
        nextActionAt: new Date(connectedAt.getTime() + gapDays * DAY),
      },
    };
  }
  return null;
}

/**
 * One transition for a due, active run. Caller guarantees status === 'active' and
 * now >= nextActionAt. Conversion/reply gates run elsewhere and flip status, so they
 * never reach this function.
 */
export function advanceSequence(ctx: SequenceTickContext): SequenceDecision {
  if (ctx.killSwitch || ctx.accountPaused) return { kind: "hold" };

  const stage = ctx.run.currentStage;
  if (stage === "done") return { kind: "exhaust", patch: { status: "exhausted", currentStage: "done" } };

  // current stage unusable (disabled / missing id / suppressed) -> skip it
  if (!stageUsable(stage, ctx)) return advanceOrExhaust(ctx);

  const gated = connectionGate(ctx);
  if (gated) return gated;

  const target = stageTarget(stage, ctx.config);
  const cfg = ctx.config.stages[stage];

  if (ctx.run.touchesDone < target) {
    const touchNo = ctx.run.touchesDone + 1;
    const isLast = touchNo === target;
    const delayDays = isLast ? cfg.waitDays : cfg.touchGapDays;
    return {
      kind: "dispatch",
      stage,
      touchNo,
      patch: {
        touchesDone: touchNo,
        lastTouchAt: ctx.now,
        nextActionAt: new Date(ctx.now.getTime() + delayDays * DAY),
      },
    };
  }

  // Touches exhausted and the wait window elapsed. A lead who REPLIED earns one parked
  // revival before the run may exhaust — spent by stamping revivedAt (never repeats).
  if (ctx.leadReplied && ctx.run.revivedAt === null) {
    return {
      kind: "park",
      patch: {
        touchesDone: Math.max(0, target - 1), // exactly one touch of headroom
        nextActionAt: new Date(ctx.now.getTime() + SOFT_NO_REVIVAL_DAYS * DAY),
        revivedAt: ctx.now,
      },
    };
  }

  // touches exhausted and the wait window has elapsed (run is due) -> advance
  return advanceOrExhaust(ctx);
}
