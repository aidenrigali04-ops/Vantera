import { decideExperimentV2 } from "../optimize/decide-v2";
import { leadBucket } from "../optimize/allocate";
import type { ArenaKey } from "./arenas";
import type { HiveConfig } from "./config";
import { genomeSignature, type Genome } from "./genome";
import { gateCounts, zeroCounts, type ArmCounts } from "./outcome";

/**
 * A container is one generation of one arena's tournament for one account: the reigning champion
 * plus 1–3 challengers, each a FULL genome one gene away from the champion. Units are routed by a
 * stable hash; every challenger is judged against the champion by the anytime-valid e-process gate
 * (decideExperimentV2, breaker first) at alpha/k (Bonferroni across the container's challengers, so
 * racing several ideas never inflates the false-promotion rate). Pure reducers — no I/O.
 */

/** Conversations (accepted connections) a challenger needs before the harm breaker may judge it,
 *  and before it may be promoted. Below this, a lift can't be separated from unseen harm. */
export const HARM_MIN_CONVERSATIONS = 15;

export type VariantOrigin = "champion" | "mutation" | "crossover" | "llm";
export type VariantStatus = "live" | "killed" | "halted" | "promoted" | "retired";

export type Variant = {
  id: string;
  genome: Genome;
  signature: string;
  origin: VariantOrigin;
  status: VariantStatus;
  reason?: string;
  decidedDay?: number;
  counts: ArmCounts;
};

export type ContainerStatus = "running" | "promoted" | "exhausted" | "timeout";

export type Container = {
  id: string;
  accountId: string;
  arena: ArenaKey;
  generation: number;
  parentId: string | null;
  status: ContainerStatus;
  champion: Variant;
  challengers: Variant[];
  /** alpha drawn from the track's wealth to fund this container */
  alphaSpent: number;
  startedDay: number;
  endedDay?: number;
  endReason?: string;
  /** id of the promoted challenger, when status === 'promoted' */
  winnerId?: string;
};

export function newContainer(input: {
  id: string;
  accountId: string;
  arena: ArenaKey;
  generation: number;
  parentId: string | null;
  champion: Genome;
  challengers: { genome: Genome; origin: VariantOrigin }[];
  alphaSpent: number;
  day: number;
}): Container {
  return {
    id: input.id,
    accountId: input.accountId,
    arena: input.arena,
    generation: input.generation,
    parentId: input.parentId,
    status: "running",
    champion: {
      id: `${input.id}:champion`,
      genome: input.champion,
      signature: genomeSignature(input.arena, input.champion),
      origin: "champion",
      status: "live",
      counts: zeroCounts(),
    },
    challengers: input.challengers.map((c, i) => ({
      id: `${input.id}:c${i + 1}`,
      genome: c.genome,
      signature: genomeSignature(input.arena, c.genome),
      origin: c.origin,
      status: "live" as const,
      counts: zeroCounts(),
    })),
    alphaSpent: input.alphaSpent,
    startedDay: input.day,
  };
}

/**
 * Route a unit to an arm. Stable for the (container, unit) pair. A killed/halted challenger stops
 * receiving NEW units immediately (its share returns to the champion); units already routed stay
 * attributed to the arm they saw.
 */
export function assignArm(c: Container, unitId: string, cfg: HiveConfig): Variant {
  const live = c.challengers.filter((v) => v.status === "live");
  if (c.status !== "running" || live.length === 0) return c.champion;
  const bucket = leadBucket(c.id, unitId); // 0..99
  const championCut = Math.round(100 * (1 - cfg.challengerShare));
  if (bucket < championCut) return c.champion;
  return live[(bucket - championCut) % live.length]!;
}

export type ContainerEvent =
  | { kind: "killed" | "halted" | "promoted" | "retired"; variantId: string; reason: string }
  | { kind: "concluded"; status: Exclude<ContainerStatus, "running">; reason: string };

/**
 * Evaluate a running container once (the daily tick). Mutates `c` in place and returns what
 * happened. Order per challenger: breaker → evidence → practical win (all inside V2). The FIRST
 * day any challenger clears the promotion bar the container concludes; if several clear together,
 * the one with the highest observed rate wins and the rest retire (they were not proven worse).
 */
export function evaluateContainer(c: Container, cfg: HiveConfig, day: number, rand: () => number): ContainerEvent[] {
  if (c.status !== "running") return [];
  const events: ContainerEvent[] = [];
  const k = Math.max(1, c.challengers.length);
  const alpha = c.alphaSpent / k;
  const winners: Variant[] = [];

  for (const v of c.challengers) {
    if (v.status !== "live") continue;
    // The breaker needs a floor sample of CONVERSATIONS, not invites, before it may trip.
    if (v.counts.harmDenominator < HARM_MIN_CONVERSATIONS && v.counts.harmDenominator < v.counts.denominator) {
      // Not enough conversations to judge harm: evaluate the win metric with negatives withheld.
      const verdict = decideExperimentV2(
        { ...gateCounts(c.champion.counts), negatives: 0 },
        { ...gateCounts(v.counts), negatives: 0 },
        { alpha, minEffectPp: cfg.minEffectPp, maxAdoptionLossPp: cfg.maxAdoptionLossPp, rng: rand }
      );
      // A promotion is deferred until harm can be judged; kills stand.
      if (verdict.decision === "adopt_challenger") continue;
      if (verdict.decision === "discard_challenger") {
        v.status = "killed"; v.reason = verdict.reason; v.decidedDay = day;
        events.push({ kind: "killed", variantId: v.id, reason: verdict.reason });
      }
      continue;
    }
    const verdict = decideExperimentV2(gateCounts(c.champion.counts), gateCounts(v.counts), {
      alpha,
      minEffectPp: cfg.minEffectPp,
      maxAdoptionLossPp: cfg.maxAdoptionLossPp,
      rng: rand,
    });
    if (verdict.decision === "halt") {
      v.status = "halted";
      v.reason = verdict.reason;
      v.decidedDay = day;
      events.push({ kind: "halted", variantId: v.id, reason: verdict.reason });
    } else if (verdict.decision === "discard_challenger") {
      v.status = "killed";
      v.reason = verdict.reason;
      v.decidedDay = day;
      events.push({ kind: "killed", variantId: v.id, reason: verdict.reason });
    } else if (verdict.decision === "adopt_challenger") {
      v.reason = verdict.reason;
      winners.push(v);
    }
  }

  if (winners.length > 0) {
    const rate = (x: Variant) => (x.counts.denominator ? x.counts.successes / x.counts.denominator : 0);
    winners.sort((a, b) => rate(b) - rate(a));
    const w = winners[0]!;
    w.status = "promoted";
    w.decidedDay = day;
    events.push({ kind: "promoted", variantId: w.id, reason: w.reason ?? "promoted" });
    for (const v of c.challengers) {
      if (v.status === "live") {
        v.status = "retired";
        v.decidedDay = day;
        events.push({ kind: "retired", variantId: v.id, reason: "container concluded with another winner" });
      }
    }
    conclude(c, "promoted", `promoted ${w.id}`, day);
    c.winnerId = w.id;
    events.push({ kind: "concluded", status: "promoted", reason: w.reason ?? "promoted" });
    return events;
  }

  if (c.challengers.every((v) => v.status !== "live")) {
    conclude(c, "exhausted", "every challenger was killed or halted", day);
    events.push({ kind: "concluded", status: "exhausted", reason: c.endReason! });
    return events;
  }

  if (day - c.startedDay >= cfg.maxContainerDays) {
    for (const v of c.challengers) {
      if (v.status === "live") {
        v.status = "retired";
        v.decidedDay = day;
        events.push({ kind: "retired", variantId: v.id, reason: "timed out without a decision" });
      }
    }
    conclude(c, "timeout", `no decision within ${cfg.maxContainerDays} days`, day);
    events.push({ kind: "concluded", status: "timeout", reason: c.endReason! });
  }
  return events;
}

function conclude(c: Container, status: Exclude<ContainerStatus, "running">, reason: string, day: number) {
  c.status = status;
  c.endReason = reason;
  c.endedDay = day;
}

/** A conclusion that reached a statistical verdict (earns alpha back); timeouts and halts don't. */
export function isDecisive(c: Container): boolean {
  if (c.status === "promoted") return true;
  if (c.status === "exhausted") return c.challengers.some((v) => v.status === "killed");
  return false;
}
