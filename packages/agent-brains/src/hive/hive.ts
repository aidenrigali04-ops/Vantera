import { ALPHA_WEALTH_START, nextAlphaSpend, wealthAfterConclusion } from "../optimize/alpha";
import { wilsonInterval } from "../optimize/funnel";
import { ARENAS, defaultGenome, liveGenes, type ArenaKey } from "./arenas";
import { clampHiveConfig, type HiveConfig } from "./config";
import { assignArm, evaluateContainer, isDecisive, newContainer, type Container, type ContainerEvent } from "./container";
import { genomeSignature, type Genome } from "./genome";
import { proposeIdeas, type LibraryStats } from "./ideas";
import { applyDelta, contribution, zeroCounts, type HiveOutcome } from "./outcome";

/**
 * The Hive: every account × arena runs its own continuous tournament track. A track always has at
 * most one live container; when it concludes, the next generation starts from the (possibly new)
 * champion with fresh ideas. Tracks stop exploring when they converge (maxPlateau generations with
 * no promotion) or meet their goal, then re-open after a cooldown to catch drift. All tracks of all
 * arenas run concurrently: each arena randomizes independently on its own lever (a factorial
 * design), so their tests don't confound each other.
 *
 * Cross-account learning is aggregate-only: pooled counts per genome signature and the genomes that
 * won promotions. No prospect data or message text is shared between accounts.
 *
 * State is plain data so the live pipeline can persist it row-for-row; every function is pure apart
 * from mutating the state object it's given. RNG injected.
 */

export type TrackStatus = "active" | "converged" | "goal_met" | "paused";

export type ArenaTrack = {
  accountId: string;
  arena: ArenaKey;
  champion: Genome;
  status: TrackStatus;
  generation: number;
  plateau: number;
  wealth: number;
  reopenDay: number;
  liveContainerId: string | null;
  lastContainerId: string | null;
  /** signatures that failed for this account in the current epoch (never re-raced until reopen) */
  failed: Set<string>;
  goalRate?: number;
};

export type HiveLogEntry = {
  day: number;
  accountId: string;
  arena: ArenaKey;
  containerId: string | null;
  kind: ContainerEvent["kind"] | "started" | "converged" | "goal_met" | "reopened" | "paused";
  variantId?: string;
  genome?: Genome;
  reason: string;
};

/** The pseudo-account that owns pooled (cross-account) tracks. */
export const HIVE_POOL = "hive";

export type HiveState = {
  cfg: HiveConfig;
  /**
   * Arenas whose tournament runs ONCE across all accounts instead of per account. Low-volume
   * stages (one account sees well under one interested reply a day) can't reach a verdict alone;
   * pooled, every account's units feed the same container and a promotion applies to all of them.
   * Trade-off: a pooled winner is the best on average — accounts that differ a lot (segment flips)
   * are better served per-account once they have the volume.
   */
  pooled: Set<ArenaKey>;
  /** "live" restricts ideas to wired genes; "sim" lets every gene evolve */
  mode: "live" | "sim";
  arenas: ArenaKey[];
  tracks: Map<string, ArenaTrack>;
  containers: Map<string, Container>;
  library: LibraryStats;
  /** per arena: genomes that won promotions, with the accounts they won for */
  winners: Map<ArenaKey, Map<string, { genome: Genome; accounts: Set<string> }>>;
  log: HiveLogEntry[];
  seq: number;
};

export type Assignment = {
  arena: ArenaKey;
  containerId: string | null;
  variantId: string | null;
  genome: Genome;
};

const trackKey = (accountId: string, arena: ArenaKey) => `${accountId}:${arena}`;

export function createHive(input: {
  accounts: string[];
  arenas?: ArenaKey[];
  cfg?: Partial<HiveConfig>;
  mode?: "live" | "sim";
  goals?: Partial<Record<ArenaKey, number>>;
  /** starting champions per account+arena (defaults to the arena default genome) */
  champions?: Map<string, Genome>;
  /** arenas run as one pooled tournament across all accounts */
  pooledArenas?: ArenaKey[];
}): HiveState {
  const arenas = input.arenas ?? (Object.keys(ARENAS) as ArenaKey[]);
  const pooled = new Set((input.pooledArenas ?? []).filter((a) => arenas.includes(a)));
  const tracks = new Map<string, ArenaTrack>();
  for (const accountId of [...input.accounts, HIVE_POOL]) {
    for (const arena of arenas) {
      if ((accountId === HIVE_POOL) !== pooled.has(arena)) continue;
      const key = trackKey(accountId, arena);
      tracks.set(key, {
        accountId,
        arena,
        champion: input.champions?.get(key) ?? defaultGenome(arena),
        status: "active",
        generation: 0,
        plateau: 0,
        wealth: ALPHA_WEALTH_START,
        reopenDay: 0,
        liveContainerId: null,
        lastContainerId: null,
        failed: new Set(),
        goalRate: input.goals?.[arena],
      });
    }
  }
  return {
    cfg: clampHiveConfig(input.cfg),
    pooled,
    mode: input.mode ?? "live",
    arenas,
    tracks,
    containers: new Map(),
    library: new Map(),
    winners: new Map(arenas.map((a) => [a, new Map()])),
    log: [],
    seq: 0,
  };
}

/** The track that governs `arena` for `accountId` (the pooled track when the arena is pooled). */
export function getTrack(state: HiveState, accountId: string, arena: ArenaKey): ArenaTrack | undefined {
  return state.tracks.get(trackKey(state.pooled.has(arena) ? HIVE_POOL : accountId, arena));
}

/** Route one new unit through every arena that applies to it. */
export function assignUnit(
  state: HiveState,
  accountId: string,
  unit: { id: string; source: "icp" | "intent" }
): Assignment[] {
  const out: Assignment[] = [];
  for (const arena of state.arenas) {
    if (!ARENAS[arena].appliesToUnit(unit)) continue;
    const track = getTrack(state, accountId, arena);
    if (!track) continue;
    const c = track.liveContainerId ? state.containers.get(track.liveContainerId) : undefined;
    if (c && c.status === "running") {
      const v = assignArm(c, unit.id, state.cfg);
      out.push({ arena, containerId: c.id, variantId: v.id, genome: v.genome });
    } else {
      out.push({ arena, containerId: null, variantId: null, genome: track.champion });
    }
  }
  return out;
}

/** Apply a unit's outcome change (before → after) to its arms and to the pooled library. */
export function recordOutcome(state: HiveState, assignments: Assignment[], before: HiveOutcome, after: HiveOutcome): void {
  for (const a of assignments) {
    const metric = ARENAS[a.arena].metric;
    const b = contribution(metric, before);
    const f = contribution(metric, after);
    if (b.denominator === f.denominator && b.successes === f.successes && b.negatives === f.negatives) continue;
    const sig = genomeSignature(a.arena, a.genome);
    const lib = state.library.get(sig) ?? zeroCounts();
    applyDelta(lib, b, f);
    state.library.set(sig, lib);
    if (a.containerId && a.variantId) {
      const c = state.containers.get(a.containerId);
      if (!c) continue;
      const v = a.variantId === c.champion.id ? c.champion : c.challengers.find((x) => x.id === a.variantId);
      if (v) applyDelta(v.counts, b, f);
    }
  }
}

export type TickOptions = {
  day: number;
  rand: () => number;
  /** optional LLM idea source: parsed JSON proposals for an arena given the champion */
  proposeLlm?: (arena: ArenaKey, champion: Genome) => unknown[];
};

/** One daily tick: evaluate every live container, conclude, then (re)start tracks that need one. */
export function tick(state: HiveState, opts: TickOptions): HiveLogEntry[] {
  const before = state.log.length;
  for (const track of state.tracks.values()) {
    const c = track.liveContainerId ? state.containers.get(track.liveContainerId) : undefined;
    if (c && c.status === "running") {
      const events = evaluateContainer(c, state.cfg, opts.day, opts.rand);
      for (const e of events) {
        state.log.push({
          day: opts.day,
          accountId: track.accountId,
          arena: track.arena,
          containerId: c.id,
          kind: e.kind,
          variantId: "variantId" in e ? e.variantId : undefined,
          genome:
            "variantId" in e ? c.challengers.find((v) => v.id === e.variantId)?.genome : undefined,
          reason: e.reason,
        });
      }
      if (c.status !== "running") concludeTrack(state, track, c, opts.day);
    }
    if (!track.liveContainerId) maybeStart(state, track, opts);
  }
  return state.log.slice(before);
}

function concludeTrack(state: HiveState, track: ArenaTrack, c: Container, day: number) {
  track.liveContainerId = null;
  track.lastContainerId = c.id;
  for (const v of c.challengers) if (v.status === "killed" || v.status === "halted") track.failed.add(v.signature);
  if (isDecisive(c)) track.wealth = wealthAfterConclusion(track.wealth);

  if (c.status === "promoted") {
    const w = c.challengers.find((v) => v.id === c.winnerId)!;
    track.failed.add(c.champion.signature); // the dethroned champion lost a head-to-head
    track.champion = w.genome;
    track.plateau = 0;
    const byArena = state.winners.get(track.arena)!;
    const entry = byArena.get(w.signature) ?? { genome: w.genome, accounts: new Set<string>() };
    entry.accounts.add(track.accountId);
    byArena.set(w.signature, entry);
    if (track.goalRate !== undefined) {
      const lowPct = wilsonInterval(w.counts.successes, w.counts.denominator).low;
      if (w.counts.denominator >= 50 && lowPct / 100 >= track.goalRate) {
        setDormant(state, track, "goal_met", day, `goal ${(track.goalRate * 100).toFixed(1)}% met`);
        return;
      }
    }
  } else {
    track.plateau++;
  }
  if (track.plateau >= state.cfg.maxPlateau) {
    setDormant(state, track, "converged", day, `${track.plateau} generations without a promotion`);
  }
}

function setDormant(state: HiveState, track: ArenaTrack, status: "converged" | "goal_met", day: number, reason: string) {
  track.status = status;
  track.reopenDay = day + state.cfg.cooldownDays;
  state.log.push({ day, accountId: track.accountId, arena: track.arena, containerId: null, kind: status, reason });
}

function maybeStart(state: HiveState, track: ArenaTrack, opts: TickOptions) {
  if (track.status === "converged" || track.status === "goal_met" || track.status === "paused") {
    if (opts.day < track.reopenDay) return;
    // New epoch: drift check. Error control is per epoch, so the alpha budget resets with it.
    track.status = "active";
    track.plateau = 0;
    track.failed = new Set();
    track.wealth = ALPHA_WEALTH_START;
    state.log.push({ day: opts.day, accountId: track.accountId, arena: track.arena, containerId: null, kind: "reopened", reason: "cooldown elapsed" });
  }
  const spend = nextAlphaSpend(track.wealth);
  if (spend === null) {
    track.status = "paused";
    track.reopenDay = opts.day + state.cfg.cooldownDays;
    state.log.push({ day: opts.day, accountId: track.accountId, arena: track.arena, containerId: null, kind: "paused", reason: "alpha budget exhausted for this epoch" });
    return;
  }
  const donors = [...state.winners.get(track.arena)!.values()]
    .filter((w) => !w.accounts.has(track.accountId) || w.accounts.size > 1)
    .sort((a, b) => b.accounts.size - a.accounts.size)
    .slice(0, 5)
    .map((w) => w.genome);
  const ideas = proposeIdeas(
    {
      arena: track.arena,
      champion: track.champion,
      allowedGenes: state.mode === "live" ? liveGenes(track.arena) : undefined,
      failedForAccount: track.failed,
      donors,
      library: state.library,
      llmProposals: opts.proposeLlm?.(track.arena, track.champion),
    },
    state.cfg,
    opts.rand
  );
  if (ideas.length === 0) {
    setDormant(state, track, "converged", opts.day, "no untested single-change ideas left");
    return;
  }
  const id = `${track.accountId}:${track.arena}:g${track.generation + 1}:${++state.seq}`;
  const c = newContainer({
    id,
    accountId: track.accountId,
    arena: track.arena,
    generation: track.generation + 1,
    parentId: track.lastContainerId,
    champion: track.champion,
    challengers: ideas,
    alphaSpent: spend,
    day: opts.day,
  });
  track.wealth -= spend;
  track.generation++;
  track.liveContainerId = id;
  state.containers.set(id, c);
  state.log.push({ day: opts.day, accountId: track.accountId, arena: track.arena, containerId: id, kind: "started", reason: `${ideas.length} challenger(s): ${ideas.map((i) => i.origin).join(", ")}` });
}
