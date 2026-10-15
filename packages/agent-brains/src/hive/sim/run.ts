import { mulberry32 } from "../../optimize/sim/harness";
import { ARENAS, defaultGenome, type ArenaKey } from "../arenas";
import type { HiveConfig } from "../config";
import { diffGenes, enumerateGenomes, validateGenome, type Genome } from "../genome";
import { assignUnit, createHive, getTrack, HIVE_POOL, recordOutcome, tick, type Assignment, type HiveState } from "../hive";
import { EMPTY_OUTCOME, type HiveOutcome } from "../outcome";
import { generateWorld, meetingsPerSourced, stageProbs, trueArenaMetric, type Family, type SimAccount, type World } from "./world";

/**
 * Runs the REAL Hive core (createHive / assignUnit / recordOutcome / tick) day by day against a
 * synthetic world. The world's truth is only used to (a) draw unit outcomes and (b) score the
 * engine afterwards — the engine sees nothing but the outcome flags, exactly as in production.
 * Pacing mirrors production: ~20 invites/day per account (LINKEDIN_STEADY_DAILY_INVITES).
 */

export const DAILY_INVITE_CAP = 20;

export type SimSpec = {
  seed: number;
  family: Family;
  accounts: number;
  horizonDays: number;
  arenas?: ArenaKey[];
  cfg?: Partial<HiveConfig>;
  /** feed mock LLM proposals (valid + deliberately invalid) through the idea validator */
  llmMock?: boolean;
  /** record a 15-day timeline for charts */
  timeline?: boolean;
  /** arenas run as one pooled tournament across the hive */
  pooledArenas?: ArenaKey[];
  /** keep the final engine state + world on the result (for the viewer export) */
  keepState?: boolean;
};

export type PromotionVerdict = "true_win" | "null" | "true_loss";

export type SimResult = {
  family: Family;
  seed: number;
  /** share of the default→oracle gap captured, integrated over the horizon (null when no gap) */
  gapClosed: number | null;
  /** expected meetings per 100 sourced: achieved / default / oracle, averaged over the horizon */
  achieved: number;
  baseline: number;
  oracle: number;
  /** final-week expected meetings per 100 sourced under the champions alone (no exploration) */
  finalChampion: number;
  promotions: Record<PromotionVerdict, number> & { total: number; harmful: number };
  kills: number;
  halts: number;
  containers: number;
  /** model ideas that made it into a container */
  llmAccepted: number;
  /** model proposals the validator refused (invalid gene/value or not a single change) */
  llmRejected: number;
  convergedTrackShare: number;
  goalMetTrackShare: number;
  timeline?: { day: number; achieved: number; baseline: number; oracle: number }[];
  state?: HiveState;
  world?: World;
  /** true relative lift of every promoted variant vs the champion it replaced */
  truthByVariant?: Map<string, number>;
  perArena: Record<string, { promotions: number; trueWins: number; falseOrLoss: number }>;
};

type Unit = {
  id: string;
  accountIdx: number;
  outcome: HiveOutcome;
  assignments: Assignment[];
};

type Event = { unit: Unit; patch: Partial<HiveOutcome> };

function geometric(r: () => number, mean: number, cap: number): number {
  const p = 1 / mean;
  let k = 0;
  while (k < cap && r() > p) k++;
  return k;
}

const ARENA_ORDER: ArenaKey[] = Object.keys(ARENAS) as ArenaKey[];

function genomesFor(assignments: Assignment[]): Partial<Record<ArenaKey, Genome>> {
  const out: Partial<Record<ArenaKey, Genome>> = {};
  for (const a of assignments) out[a.arena] = a.genome;
  return out;
}

/** Champions-only genome map for an account (what it would run with exploration switched off). */
function championGenomes(state: HiveState, accountId: string, source: "icp" | "intent"): Partial<Record<ArenaKey, Genome>> {
  const out: Partial<Record<ArenaKey, Genome>> = {};
  for (const arena of state.arenas) {
    if (!ARENAS[arena].appliesToUnit({ source })) continue;
    out[arena] = getTrack(state, accountId, arena)!.champion;
  }
  return out;
}

function defaultGenomes(arenas: ArenaKey[], source: "icp" | "intent"): Partial<Record<ArenaKey, Genome>> {
  const out: Partial<Record<ArenaKey, Genome>> = {};
  for (const arena of arenas) if (ARENAS[arena].appliesToUnit({ source })) out[arena] = defaultGenome(arena);
  return out;
}

/** Per-arena best genome on that arena's own true metric (others at default). */
function oracleGenomes(w: World, acct: SimAccount, arenas: ArenaKey[], day: number, source: "icp" | "intent") {
  const base = defaultGenomes(arenas, source);
  const out: Partial<Record<ArenaKey, Genome>> = { ...base };
  for (const arena of arenas) {
    if (!base[arena]) continue;
    let best = base[arena]!;
    let bestV = -1;
    for (const g of enumerateGenomes(arena)) {
      const v = trueArenaMetric(arena, stageProbs(w, acct, { ...base, [arena]: g }, day));
      if (v > bestV) {
        bestV = v;
        best = g;
      }
    }
    out[arena] = best;
  }
  return out;
}

export function runSim(spec: SimSpec): SimResult {
  const arenas = spec.arenas ?? ARENA_ORDER;
  const world = generateWorld({ seed: spec.seed, family: spec.family, accounts: spec.accounts, horizonDays: spec.horizonDays, arenas });
  const rand = mulberry32(spec.seed ^ 0x51ed270b);
  const engineRand = mulberry32(spec.seed ^ 0x2545f491);
  const state = createHive({ accounts: world.accounts.map((a) => a.id), arenas, cfg: spec.cfg, mode: "sim", pooledArenas: spec.pooledArenas });

  // Oracle per account per epoch (drift changes the truth half-way).
  const oracleCache = new Map<string, Partial<Record<ArenaKey, Genome>>>();
  const oracleFor = (acct: SimAccount, day: number, source: "icp" | "intent") => {
    const epoch = world.driftDay !== null && day >= world.driftDay ? 1 : 0;
    const key = `${acct.id}:${epoch}:${source}`;
    let o = oracleCache.get(key);
    if (!o) {
      o = oracleGenomes(world, acct, arenas, epoch ? world.driftDay! : 0, source);
      oracleCache.set(key, o);
    }
    return o;
  };

  // Default/oracle per-unit expectations are constant within an account+epoch+source: cache them.
  const refCache = new Map<string, { pb: number; po: number }>();
  const defaultsBySource = { icp: defaultGenomes(arenas, "icp"), intent: defaultGenomes(arenas, "intent") };
  const refFor = (acct: SimAccount, day: number, source: "icp" | "intent") => {
    const epoch = world.driftDay !== null && day >= world.driftDay ? 1 : 0;
    const key = `${acct.id}:${epoch}:${source}`;
    let v = refCache.get(key);
    if (!v) {
      v = {
        pb: meetingsPerSourced(stageProbs(world, acct, defaultsBySource[source], day)),
        po: meetingsPerSourced(stageProbs(world, acct, oracleFor(acct, day, source), day)),
      };
      refCache.set(key, v);
    }
    return v;
  };

  const events: Event[][] = Array.from({ length: spec.horizonDays + 400 }, () => []);
  let seq = 0;
  let sumAchieved = 0;
  let sumBaseline = 0;
  let sumOracle = 0;
  let nUnits = 0;
  const timeline: SimResult["timeline"] = [];
  let binA = 0, binB = 0, binO = 0, binN = 0;
  let llmAccepted = 0;
  let llmRejected = 0;

  const truthByVariant = new Map<string, number>();
  const promotions = { total: 0, true_win: 0, null: 0, true_loss: 0, harmful: 0 };
  const perArena: SimResult["perArena"] = {};
  for (const a of arenas) perArena[a] = { promotions: 0, trueWins: 0, falseOrLoss: 0 };

  const proposeLlm = spec.llmMock
    ? (arena: ArenaKey, champion: Genome): unknown[] => {
        const genes = Object.entries(ARENAS[arena].genes);
        const out: unknown[] = [];
        const n = Math.floor(rand() * 3);
        for (let i = 0; i < n; i++) {
          const roll = rand();
          const [gene, gs] = genes[Math.floor(rand() * genes.length)]!;
          if (roll < 0.6) out.push({ [gene]: gs.values[Math.floor(rand() * gs.values.length)] });
          else if (roll < 0.75) out.push({ [gene]: "a value the product has never heard of" });
          else if (roll < 0.9) out.push({ inventedGene: "x" });
          else out.push({ ...champion, ...Object.fromEntries(genes.map(([g, s]) => [g, s.values[0]])) });
        }
        return out;
      }
    : undefined;

  for (let day = 0; day < spec.horizonDays; day++) {
    // 1. Outcome events landing today.
    for (const ev of events[day]!) {
      const before = ev.unit.outcome;
      const after = { ...before, ...ev.patch };
      ev.unit.outcome = after;
      recordOutcome(state, ev.unit.assignments, before, after);
    }

    // 2. New units sourced today, routed through every arena.
    for (let ai = 0; ai < world.accounts.length; ai++) {
      const acct = world.accounts[ai]!;
      let invitesToday = 0;
      const n = Math.max(0, Math.round(acct.sourcedPerDay * (0.8 + 0.4 * rand())));
      for (let i = 0; i < n; i++) {
        const source: "icp" | "intent" = rand() < acct.intentShare ? "intent" : "icp";
        const unit: Unit = { id: `${acct.id}-u${++seq}`, accountIdx: ai, outcome: { ...EMPTY_OUTCOME, sourced: true }, assignments: [] };
        unit.assignments = assignUnit(state, acct.id, { id: unit.id, source });
        // the sourced flag counts at assignment time
        recordOutcome(state, unit.assignments, EMPTY_OUTCOME, unit.outcome);

        const p = stageProbs(world, acct, genomesFor(unit.assignments), day);
        const pd = meetingsPerSourced(p);
        const { pb, po } = refFor(acct, day, source);
        sumAchieved += pd; sumBaseline += pb; sumOracle += po; nUnits++;
        binA += pd; binB += pb; binO += po; binN++;

        if (rand() >= p.qual) continue;
        events[day]!.push({ unit, patch: { qualified: true } });
        if (invitesToday >= DAILY_INVITE_CAP) continue;
        invitesToday++;
        const dInvite = day + (rand() < 0.5 ? 0 : 1);
        events[dInvite]!.push({ unit, patch: { invited: true } });
        if (rand() >= p.acc) continue;
        const dAcc = dInvite + 1 + geometric(rand, 2, 14);
        events[dAcc]!.push({ unit, patch: { accepted: true } });
        const u = rand();
        const dRep = dAcc + 1 + geometric(rand, 4, 21);
        if (u < p.rep) {
          events[dRep]!.push({ unit, patch: { interested: true } });
          if (rand() < p.book) {
            const dBook = dRep + 1 + geometric(rand, 3, 14);
            events[dBook]!.push({ unit, patch: { booked: true } });
            if (rand() < p.close) events[dBook + 1 + geometric(rand, 10, 45)]!.push({ unit, patch: { converted: true } });
          }
        } else if (u < p.rep + p.neg) {
          events[dRep]!.push({ unit, patch: { negative: true } });
        }
      }
    }

    // 3. The daily Hive tick.
    const logs = tick(state, {
      day,
      rand: engineRand,
      proposeLlm: proposeLlm
        ? (arena, champion) => {
            const props = proposeLlm(arena, champion);
            for (const prop of props) {
              const g = validateGenome(arena, prop, champion);
              if (!g || diffGenes(champion, g).length !== 1) llmRejected++;
            }
            return props;
          }
        : undefined,
    });

    // 4. Score every promotion against the hidden truth.
    for (const l of logs) {
      if (l.kind === "started" && proposeLlm) {
        const c = state.containers.get(l.containerId!)!;
        llmAccepted += c.challengers.filter((v) => v.origin === "llm").length;
      }
      if (l.kind !== "promoted") continue;
      const c = state.containers.get(l.containerId!)!;
      const w = c.challengers.find((v) => v.id === l.variantId)!;
      const affected = l.accountId === HIVE_POOL ? world.accounts : world.accounts.filter((a) => a.id === l.accountId);
      const src: "icp" | "intent" = l.arena === "intent" ? "intent" : "icp";
      let mOld = 0, mNew = 0, negOld = 0, negNew = 0;
      for (const acct of affected) {
        const others = championGenomes(state, acct.id, src);
        const pOld = stageProbs(world, acct, { ...others, [l.arena]: c.champion.genome }, day);
        const pNew = stageProbs(world, acct, { ...others, [l.arena]: w.genome }, day);
        mOld += trueArenaMetric(l.arena, pOld);
        mNew += trueArenaMetric(l.arena, pNew);
        negOld += pOld.neg;
        negNew += pNew.neg;
      }
      const rel = (mNew - mOld) / Math.max(mOld, 1e-9);
      const verdict: PromotionVerdict = rel > 0.02 ? "true_win" : rel < -0.02 ? "true_loss" : "null";
      truthByVariant.set(w.id, rel);
      promotions.total++;
      promotions[verdict]++;
      if ((negNew - negOld) / affected.length > 0.015 && diffGenes(c.champion.genome, w.genome).length > 0) promotions.harmful++;
      perArena[l.arena]!.promotions++;
      if (verdict === "true_win") perArena[l.arena]!.trueWins++;
      else perArena[l.arena]!.falseOrLoss++;
    }

    if (spec.timeline && (day + 1) % 15 === 0 && binN > 0) {
      timeline.push({ day: day + 1, achieved: (binA / binN) * 100, baseline: (binB / binN) * 100, oracle: (binO / binN) * 100 });
      binA = binB = binO = binN = 0;
    }
  }

  // Final champions-only quality (last day, no exploration traffic).
  let finalSum = 0;
  for (const acct of world.accounts) {
    const icp = meetingsPerSourced(stageProbs(world, acct, championGenomes(state, acct.id, "icp"), spec.horizonDays - 1));
    const intent = meetingsPerSourced(stageProbs(world, acct, championGenomes(state, acct.id, "intent"), spec.horizonDays - 1));
    finalSum += (1 - acct.intentShare) * icp + acct.intentShare * intent;
  }

  let kills = 0, halts = 0;
  for (const c of state.containers.values()) {
    for (const v of c.challengers) {
      if (v.status === "killed") kills++;
      if (v.status === "halted") halts++;
    }
  }
  const tracks = [...state.tracks.values()];
  const gap = sumOracle - sumBaseline;
  return {
    family: spec.family,
    seed: spec.seed,
    gapClosed: gap / Math.max(nUnits, 1) > 1e-5 ? (sumAchieved - sumBaseline) / gap : null,
    achieved: (sumAchieved / nUnits) * 100,
    baseline: (sumBaseline / nUnits) * 100,
    oracle: (sumOracle / nUnits) * 100,
    finalChampion: (finalSum / world.accounts.length) * 100,
    promotions,
    kills,
    halts,
    containers: state.containers.size,
    llmAccepted,
    llmRejected,
    convergedTrackShare: tracks.filter((t) => t.status === "converged").length / tracks.length,
    goalMetTrackShare: tracks.filter((t) => t.status === "goal_met").length / tracks.length,
    timeline: spec.timeline ? timeline : undefined,
    perArena,
    state: spec.keepState ? state : undefined,
    world: spec.keepState ? world : undefined,
    truthByVariant: spec.keepState ? truthByVariant : undefined,
  };
}
