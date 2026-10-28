import type { Move } from "./moves";
import type { PriorCell, PriorSource, PriorTable } from "./priors";
import type { Phase, Archetype } from "./state";
import type { Readout } from "./read";

export type DecisionOutcome = {
  replied: boolean;
  stance: Readout["stance"] | null;
  furtherLeadTurns: number;
  booked: boolean;
  optOut: boolean;
  identitySuspicion: boolean;
  humanTakeover: boolean;
  waitThenReply: boolean;
};

export const REWARD = {
  reply: 1,
  positiveStance: 2,
  leadTurn: 1,
  leadTurnCap: 3,
  booked: 10,
  optOut: -5,
  negativeStance: -2,
  identitySuspicion: -4,
  humanTakeover: 0,
  waitThenReply: 1,
} as const;

export function reward(o: DecisionOutcome, move: Move): number {
  let r = 0;
  if (o.replied) r += REWARD.reply;
  if (o.stance === "positive") r += REWARD.positiveStance;
  if (o.stance === "negative") r += REWARD.negativeStance;
  r += REWARD.leadTurn * Math.min(REWARD.leadTurnCap, Math.max(0, o.furtherLeadTurns));
  if (o.booked) r += REWARD.booked;
  if (o.optOut) r += REWARD.optOut;
  if (o.identitySuspicion) r += REWARD.identitySuspicion;
  if (o.humanTakeover) r += REWARD.humanTakeover;
  if (move === "wait" && o.waitThenReply) r += REWARD.waitThenReply;
  return r;
}

export const isPositive = (r: number): boolean => r > 0;

export const IPW_CLIP = 10;

export function updateCell(cell: PriorCell, r: number, propensity: number): PriorCell {
  const p = propensity > 0 ? propensity : 1;
  const w = Math.min(1 / p, IPW_CLIP);
  return {
    ...cell,
    n: cell.n + w,
    positives: cell.positives + (isPositive(r) ? w : 0),
    rewardSum: cell.rewardSum + w * r,
    rewardSq: cell.rewardSq + w * r * r,
  };
}

export function rollup(
  decisions: { move: Move; phase: Phase; archetype: Archetype; propensity: number; reward: number }[],
  source: PriorSource,
): PriorTable {
  const cells = new Map<string, PriorCell>();
  const bump = (level: PriorCell["level"], move: Move, phase: Phase | "", archetype: Archetype | "", d: { reward: number; propensity: number }) => {
    const key = `${level}|${move}|${phase}|${archetype}`;
    const cur = cells.get(key) ?? { level, move, phase, archetype, source, n: 0, positives: 0, rewardSum: 0, rewardSq: 0 };
    cells.set(key, updateCell(cur, d.reward, d.propensity));
  };
  for (const d of decisions) {
    bump("move", d.move, "", "", d);
    bump("move_phase", d.move, d.phase, "", d);
    bump("move_phase_archetype", d.move, d.phase, d.archetype, d);
  }
  return [...cells.values()];
}
