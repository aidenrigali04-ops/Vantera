import type {
  LeadChannels, SequenceConfig, SequenceCursor, SequenceDecision, SequenceStage,
  SequenceTickContext,
} from "./types";

const DAY = 86_400_000;

/** One-shot soft-no revival (0044): a run exhausting on a lead who DID reply parks for this
 *  long, then gets exactly one more thread-aware touch. "Not right now" is a timing objection,
 *  not a no — but only once, and never for leads who never engaged. */
export const SOFT_NO_REVIVAL_DAYS = 30;

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
