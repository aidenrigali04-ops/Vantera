import { ARENAS, defaultGenome, type ArenaKey } from "../arenas";
import { diffGenes, type Genome } from "../genome";
import { HIVE_POOL } from "../hive";
import type { SimResult } from "./run";
import { stageProbs, trueArenaMetric, type World } from "./world";

/**
 * Flattens a simulation run (kept with `keepState: true`) into a plain, JSON-safe view model for
 * the Hive viewer. Adds the hidden truth for every challenger — its TRUE relative lift over the
 * champion it raced — so the viewer can reveal whether each kill/promotion was right. Pure.
 */

export type ViewVariant = {
  id: string;
  origin: string;
  status: string;
  genome: Genome;
  changed: { gene: string; from: string; to: string } | null;
  denominator: number;
  successes: number;
  negatives: number;
  reason?: string;
  decidedDay?: number;
  /** hidden truth: (true metric − champion true metric) / champion true metric */
  trueLift: number;
};

export type ViewContainer = {
  id: string;
  account: string;
  arena: ArenaKey;
  generation: number;
  parentId: string | null;
  status: string;
  startedDay: number;
  endedDay?: number;
  endReason?: string;
  alphaSpent: number;
  winnerId?: string;
  champion: ViewVariant;
  challengers: ViewVariant[];
};

export type ViewRun = {
  family: string;
  seed: number;
  horizonDays: number;
  pooledArenas: ArenaKey[];
  summary: Omit<SimResult, "state" | "world" | "truthByVariant" | "timeline" | "perArena">;
  perArena: SimResult["perArena"];
  timeline: NonNullable<SimResult["timeline"]>;
  accounts: { id: string; segment: number; sourcedPerDay: number }[];
  tracks: { account: string; arena: ArenaKey; status: string; generation: number; plateau: number; wealth: number; champion: Genome }[];
  containers: ViewContainer[];
  log: { day: number; account: string; arena: ArenaKey; containerId: string | null; kind: string; variantId?: string; reason: string }[];
};

function trueMetric(w: World, accountIds: string[], arena: ArenaKey, g: Genome, day: number): number {
  const src = arena === "intent" ? "intent" : "icp";
  let sum = 0;
  for (const id of accountIds) {
    const acct = w.accounts.find((a) => a.id === id)!;
    const others: Partial<Record<ArenaKey, Genome>> = {};
    for (const a of Object.keys(ARENAS) as ArenaKey[]) if (ARENAS[a].appliesToUnit({ source: src })) others[a] = defaultGenome(a);
    sum += trueArenaMetric(arena, stageProbs(w, acct, { ...others, [arena]: g }, day));
  }
  return sum / accountIds.length;
}

export function exportRun(r: SimResult, horizonDays: number, pooledArenas: ArenaKey[] = []): ViewRun {
  const state = r.state;
  const w = r.world;
  if (!state || !w) throw new Error("exportRun needs a run made with keepState: true");
  const allIds = w.accounts.map((a) => a.id);

  const containers: ViewContainer[] = [];
  for (const c of state.containers.values()) {
    const ids = c.accountId === HIVE_POOL ? allIds : [c.accountId];
    const day = Math.min(c.endedDay ?? horizonDays - 1, horizonDays - 1);
    const champTrue = trueMetric(w, ids, c.arena, c.champion.genome, day);
    const toView = (v: typeof c.champion): ViewVariant => {
      const diff = diffGenes(c.champion.genome, v.genome);
      const gene = diff[0];
      const t = trueMetric(w, ids, c.arena, v.genome, v.decidedDay ?? day);
      return {
        id: v.id,
        origin: v.origin,
        status: v.status,
        genome: v.genome,
        changed: gene ? { gene, from: c.champion.genome[gene]!, to: v.genome[gene]! } : null,
        denominator: v.counts.denominator,
        successes: v.counts.successes,
        negatives: v.counts.negatives,
        reason: v.reason,
        decidedDay: v.decidedDay,
        trueLift: v.origin === "champion" ? 0 : (t - champTrue) / Math.max(champTrue, 1e-9),
      };
    };
    containers.push({
      id: c.id,
      account: c.accountId,
      arena: c.arena,
      generation: c.generation,
      parentId: c.parentId,
      status: c.status,
      startedDay: c.startedDay,
      endedDay: c.endedDay,
      endReason: c.endReason,
      alphaSpent: c.alphaSpent,
      winnerId: c.winnerId,
      champion: toView(c.champion),
      challengers: c.challengers.map(toView),
    });
  }

  const { state: _s, world: _w, truthByVariant: _t, timeline, perArena, ...summary } = r;
  return {
    family: r.family,
    seed: r.seed,
    horizonDays,
    pooledArenas,
    summary,
    perArena,
    timeline: timeline ?? [],
    accounts: w.accounts.map((a) => ({ id: a.id, segment: a.segment, sourcedPerDay: a.sourcedPerDay })),
    tracks: [...state.tracks.values()].map((t) => ({
      account: t.accountId,
      arena: t.arena,
      status: t.status,
      generation: t.generation,
      plateau: t.plateau,
      wealth: t.wealth,
      champion: t.champion,
    })),
    containers,
    log: state.log.map((l) => ({ day: l.day, account: l.accountId, arena: l.arena, containerId: l.containerId, kind: l.kind, variantId: l.variantId, reason: l.reason })),
  };
}
