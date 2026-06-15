import type {
  LeadChannels, SequenceConfig, SequenceCursor, SequenceDecision, SequenceStage,
  SequenceTickContext,
} from "./types";

const DAY = 86_400_000;

function hasIdentifier(stage: SequenceStage, ch: LeadChannels): boolean {
  switch (stage) {
    case "linkedin": return !!ch.linkedinUrl;
    case "email": return !!ch.email && ch.emailStatus === "valid";
    case "imessage":
    case "call": return !!ch.phone && ch.phoneStatus !== "invalid";
  }
}

function isSuppressed(stage: SequenceStage, s: SequenceTickContext["suppressed"]): boolean {
  if (stage === "linkedin") return s.linkedin;
  if (stage === "email") return s.email;
  return s.phone; // imessage + call
}

function stageUsable(stage: SequenceStage, ctx: SequenceTickContext): boolean {
  return ctx.config.stages[stage].enabled && hasIdentifier(stage, ctx.channels) && !isSuppressed(stage, ctx.suppressed);
}

function stageTarget(stage: SequenceStage, config: SequenceConfig): number {
  const cfg = config.stages[stage];
  return stage === "call" ? (cfg.maxAttempts ?? 2) : cfg.touches;
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
    patch: { currentStage: next, touchesDone: 0, callAttempts: ctx.run.callAttempts, enteredStageAt: ctx.now, nextActionAt: ctx.now },
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
        callAttempts: stage === "call" ? ctx.run.callAttempts + 1 : ctx.run.callAttempts,
        lastTouchAt: ctx.now,
        nextActionAt: new Date(ctx.now.getTime() + delayDays * DAY),
      },
    };
  }

  // touches exhausted and the wait window has elapsed (run is due) -> advance
  return advanceOrExhaust(ctx);
}
