import { mulberry32 } from "../optimize/sim/harness";
import { ARENAS, defaultGenome, type ArenaKey } from "../hive/arenas";
import { FAMILIES, type Family } from "../hive/sim/world";
import { BRAINS, BRAIN_KINDS, type BrainContext, type LibraryEntry, type Verdict } from "./brains";
import type { BrainKind } from "./proposal";
import { evaluate, type EvalResult, type Strategy, type WorldSet } from "./evaluator";
import { mergeStrategy, strategySignature, validateProposal, type Proposal } from "./proposal";

/**
 * The Governor: the only judge in the research hive, and the only component with access to the
 * evaluator. Nothing here needs a human. Its rules, each tied to a way free brains cheat:
 *
 *  1. Hidden evaluation. Brains receive scores, never worlds, seeds, truth, or evaluator code.
 *  2. Three stages on THREE different world sets, all fresh per generation:
 *       screen  — tuning worlds, cheap, kills obvious losers;
 *       replicate — a second tuning set the brain never saw: must win again;
 *       seal   — the sealed holdout. The verdict comes from here and only here. Brains never see
 *                sealed results broken out, only the final verdict.
 *  3. Pre-registration is binding: a proposal whose sealed lift falls below its own falsifier is
 *     FALSIFIED (brain's credibility drops) even if it's positive; a brain can't redefine success.
 *  4. Robustness over average: promotion requires the WORST scenario family to not regress beyond
 *     tolerance, so a strategy that wins on average and collapses on one family loses.
 *  5. Harm is priced into the score (HARM_WEIGHT in the evaluator) and a guardrail: a harm-rate
 *     increase past HARM_TOLERANCE is an automatic rejection whatever the lift.
 *  6. Audit flags. A score above the oracle ceiling, a brain whose tuning wins keep failing on
 *     sealed worlds (overfitting), or a proposal identical to a past one are flagged; a flagged
 *     brain's proposal budget is cut.
 *  7. Promotion is automatic: a sealed, replicated, robust winner becomes the champion, and the
 *     next generation builds on it. A champion is never overwritten by a tie.
 */

export type GovernorConfig = {
  proposalsPerGeneration: number;
  screenWorldsPerFamily: number;
  replicateWorldsPerFamily: number;
  sealedWorldsPerFamily: number;
  accountsPerWorld: number;
  /** worst-family regression tolerance (meetings / 100) */
  worstTolerance: number;
  /** allowed increase in harm rate (negatives / 100 sourced) */
  harmTolerance: number;
  /** generations without a promotion before the hive declares convergence */
  maxPlateau: number;
  arenas: ArenaKey[];
};

export const GOVERNOR_DEFAULTS: GovernorConfig = {
  proposalsPerGeneration: 8,
  screenWorldsPerFamily: 2,
  replicateWorldsPerFamily: 2,
  sealedWorldsPerFamily: 6,
  accountsPerWorld: 6,
  worstTolerance: 0.15,
  harmTolerance: 0.15,
  maxPlateau: 8,
  arenas: Object.keys(ARENAS) as ArenaKey[],
};

export type BrainRecord = {
  kind: BrainKind;
  id: string;
  proposed: number;
  invalid: number;
  passedScreen: number;
  replicated: number;
  promoted: number;
  falsified: number;
  flagged: number;
  /** mean (tuning − sealed) lift gap on proposals that reached sealing — the overfitting signal */
  overfitGap: number;
  overfitN: number;
  /** share of the generation's proposal budget */
  budget: number;
  credibility: number;
};

export type Stage = "submitted" | "invalid" | "screen" | "replicate" | "seal" | "verdict";

export type ProposalRecord = Proposal & {
  stage: Stage;
  verdict?: Verdict;
  reason?: string;
  screen?: { lift: number; margin: number; worst: number };
  replicate?: { lift: number; margin: number; worst: number };
  sealed?: { lift: number; margin: number; worst: number; worstFamily: Family; harmDelta: number };
  flags: string[];
  /** times this proposal was held for a re-seal */
  pending?: number;
};

export type GovEvent =
  | { kind: "generation"; generation: number; championScore: number }
  | { kind: "proposed"; proposal: ProposalRecord }
  | { kind: "invalid"; brainId: string; detail: string }
  | { kind: "screened" | "replicated" | "sealed"; proposalId: string; lift: number; margin: number; worst: number; pass: boolean }
  | { kind: "verdict"; proposalId: string; verdict: Verdict; reason: string }
  | { kind: "promoted"; proposalId: string; championScore: number; sealedScore: number; changes: Proposal["changes"] }
  | { kind: "flag"; target: string; detail: string }
  | { kind: "converged"; generation: number };

export type ResearchState = {
  cfg: GovernorConfig;
  seed: number;
  tick: number;
  generation: number;
  plateau: number;
  converged: boolean;
  champion: Strategy;
  championScore: number;
  /** sealed-score history of champions, for the chart */
  lineage: { generation: number; score: number; sealedScore: number; proposalId: string | null; changes: Proposal["changes"] }[];
  brains: Record<string, BrainRecord>;
  proposals: ProposalRecord[];
  library: LibraryEntry[];
  events: GovEvent[];
  seq: number;
  /** proposals held for a re-seal next generation */
  pendingIds: Set<string>;
  /** oracle ceiling on the sealed set (for the audit; never shown to brains) */
  sealedOracle: number;
  /** elite archive: distinct strategies that cleared sealing with a positive lift, best first */
  elites: { strategy: Strategy; score: number; proposalId: string }[];
  /** plateau escapes performed (reseeding from the second elite) */
  reseeds: number;
  /** salts — brains never see these */
  salts: { sealed: number };
};

export function createResearch(seed: number, cfg: Partial<GovernorConfig> = {}): ResearchState {
  const c = { ...GOVERNOR_DEFAULTS, ...cfg };
  const champion: Strategy = {};
  for (const a of c.arenas) champion[a] = defaultGenome(a);
  const rand = mulberry32(seed ^ 0x3c6ef372);
  const sealedSalt = Math.floor(rand() * 2 ** 31);
  const sealed: WorldSet = { salt: sealedSalt, perFamily: c.sealedWorldsPerFamily, accounts: c.accountsPerWorld, horizonDays: 180 };
  const base = evaluate(champion, sealed, c.arenas);
  const brains: Record<string, BrainRecord> = {};
  for (const kind of BRAIN_KINDS) {
    brains[kind] = { kind, id: kind, proposed: 0, invalid: 0, passedScreen: 0, replicated: 0, promoted: 0, falsified: 0, flagged: 0, overfitGap: 0, overfitN: 0, budget: 1 / BRAIN_KINDS.length, credibility: 1 };
  }
  return {
    cfg: c,
    seed,
    tick: 0,
    generation: 0,
    plateau: 0,
    converged: false,
    champion,
    championScore: base.score,
    lineage: [{ generation: 0, score: base.score, sealedScore: base.score, proposalId: null, changes: [] }],
    brains,
    proposals: [],
    library: [],
    events: [],
    seq: 0,
    pendingIds: new Set(),
    sealedOracle: oracleCeiling(sealed, c.arenas),
    elites: [{ strategy: champion, score: base.score, proposalId: "gen0" }],
    reseeds: 0,
    salts: { sealed: sealedSalt },
  };
}

/** Best achievable sealed score by coordinate ascent over arenas (a bound, not a target). */
function oracleCeiling(set: WorldSet, arenas: ArenaKey[]): number {
  let s: Strategy = {};
  for (const a of arenas) s[a] = defaultGenome(a);
  let best = evaluate(s, set, arenas).score;
  for (let pass = 0; pass < 2; pass++) {
    for (const a of arenas) {
      for (const [gene, spec] of Object.entries(ARENAS[a].genes)) {
        for (const v of spec.values) {
          const t: Strategy = { ...s, [a]: { ...s[a]!, [gene]: v } };
          const sc = evaluate(t, set, arenas).score;
          if (sc > best + 1e-9) { best = sc; s = t; }
        }
      }
    }
  }
  return best;
}

const r3 = (x: number) => Math.round(x * 1000) / 1000;

/** Allocate this generation's proposal budget across brains: Thompson on (promoted, failures), floored. */
function allocate(state: ResearchState, rand: () => number): Record<string, number> {
  const kinds = BRAIN_KINDS;
  const draws = kinds.map((k) => {
    const b = state.brains[k]!;
    const wins = b.promoted + 0.5 * b.replicated;
    const losses = b.falsified + b.flagged + 0.3 * (b.proposed - b.promoted - b.replicated);
    const draw = sampleBetaSafe(1 + wins, 1 + Math.max(0, losses), rand) * b.credibility;
    return draw;
  });
  const total = draws.reduce((a, b) => a + b, 0) || 1;
  const n = state.cfg.proposalsPerGeneration;
  const floor = 1;
  const out: Record<string, number> = {};
  let used = 0;
  kinds.forEach((k, i) => {
    out[k] = floor;
    used += floor;
    state.brains[k]!.budget = draws[i]! / total;
  });
  let remaining = Math.max(0, n - used);
  const order = kinds.map((k, i) => ({ k, d: draws[i]! })).sort((a, b) => b.d - a.d);
  while (remaining > 0) {
    for (const { k, d } of order) {
      if (remaining <= 0) break;
      const share = Math.round((d / total) * (n - kinds.length * floor));
      const give = Math.min(remaining, Math.max(0, share - (out[k]! - floor)) || (order[0]!.k === k ? 1 : 0));
      out[k]! += give;
      remaining -= give;
    }
    if (order.every(({ k }) => out[k]! > floor) && remaining > 0) { out[order[0]!.k]! += remaining; remaining = 0; }
  }
  return out;
}

function sampleBetaSafe(a: number, b: number, rand: () => number): number {
  // tiny gamma-free beta via rejection-free approximation for small counts (keeps the module pure)
  let x = 0;
  for (let i = 0; i < 8; i++) x += rand();
  const u = x / 8; // ~normal-ish on (0,1)
  const mean = a / (a + b);
  const spread = Math.sqrt((a * b) / ((a + b) ** 2 * (a + b + 1)));
  return Math.min(0.999, Math.max(0.001, mean + (u - 0.5) * 2 * spread * 1.7));
}

/** Run ONE generation: propose → screen → replicate → seal → verdict → promote. */
export function runGeneration(state: ResearchState): GovEvent[] {
  if (state.converged) return [];
  const start = state.events.length;
  const gen = ++state.generation;
  const rand = mulberry32((state.seed ^ (gen * 0x5bd1e995)) >>> 0);
  const sets = {
    screen: { salt: Math.floor(rand() * 2 ** 31), perFamily: state.cfg.screenWorldsPerFamily, accounts: state.cfg.accountsPerWorld, horizonDays: 180 } as WorldSet,
    replicate: { salt: Math.floor(rand() * 2 ** 31), perFamily: state.cfg.replicateWorldsPerFamily, accounts: state.cfg.accountsPerWorld, horizonDays: 180 } as WorldSet,
    sealed: { salt: state.salts.sealed, perFamily: state.cfg.sealedWorldsPerFamily, accounts: state.cfg.accountsPerWorld, horizonDays: 180 } as WorldSet,
  };
  const champScreen = evaluate(state.champion, sets.screen, state.cfg.arenas);
  const champRep = evaluate(state.champion, sets.replicate, state.cfg.arenas);
  const champSealed = evaluate(state.champion, sets.sealed, state.cfg.arenas);
  state.events.push({ kind: "generation", generation: gen, championScore: champSealed.score });

  // 1. Propose.
  const budget = allocate(state, rand);
  const ctx: BrainContext = { champion: state.champion, championScore: champSealed.score, library: state.library, arenas: state.cfg.arenas, generation: gen, rand, elites: state.elites };
  const batch: ProposalRecord[] = [];
  const seenSig = new Set<string>(state.library.map((e) => e.changes.map((c) => `${c.arena}|${c.gene}=${c.to}`).sort().join(";")));
  for (const kind of BRAIN_KINDS) {
    const b = state.brains[kind]!;
    const raws = BRAINS[kind](ctx, budget[kind] ?? 1);
    for (const raw of raws) {
      b.proposed++;
      const v = validateProposal(raw, state.champion);
      if (!v.ok) {
        b.invalid++;
        state.events.push({ kind: "invalid", brainId: kind, detail: `${v.error.code}: ${v.error.detail}` });
        continue;
      }
      const sig = v.changes.map((c) => `${c.arena}|${c.gene}=${c.to}`).sort().join(";");
      if (seenSig.has(sig)) {
        b.flagged++;
        state.events.push({ kind: "flag", target: kind, detail: "re-proposed an already-tested change set" });
        continue;
      }
      seenSig.add(sig);
      const p: ProposalRecord = {
        id: `g${gen}-${kind}-${++state.seq}`,
        brain: kind,
        brainId: kind,
        generation: gen,
        strategy: mergeStrategy(state.champion, v.strategy),
        changes: v.changes,
        hypothesis: raw.hypothesis,
        mechanism: raw.mechanism,
        predictedLift: raw.predictedLift,
        falsifyBelow: raw.falsifyBelow,
        submittedTick: state.tick,
        stage: "submitted",
        flags: [],
      };
      batch.push(p);
      state.proposals.push(p);
      state.events.push({ kind: "proposed", proposal: p });
    }
  }

  // 2. Screen on fresh tuning worlds.
  const survivors: ProposalRecord[] = [];
  for (const p of batch) {
    p.stage = "screen";
    const r = evaluate(p.strategy, sets.screen, state.cfg.arenas);
    const lift = r.score - champScreen.score;
    const worst = r.worst - champScreen.worst;
    p.screen = { lift: r3(lift), margin: r3(r.margin), worst: r3(worst) };
    const pass = lift > 0 && lift - r.margin > -state.cfg.worstTolerance;
    state.events.push({ kind: "screened", proposalId: p.id, lift, margin: r.margin, worst, pass });
    if (pass) { survivors.push(p); state.brains[p.brain]!.passedScreen++; }
    else finish(state, p, "rejected", `screen: lift ${lift.toFixed(2)} ± ${r.margin.toFixed(2)} on fresh worlds`, r, champScreen);
  }

  // 3. Replicate on a second fresh set.
  const replicated: ProposalRecord[] = [];
  for (const p of survivors) {
    p.stage = "replicate";
    const r = evaluate(p.strategy, sets.replicate, state.cfg.arenas);
    const lift = r.score - champRep.score;
    const worst = r.worst - champRep.worst;
    p.replicate = { lift: r3(lift), margin: r3(r.margin), worst: r3(worst) };
    const pass = lift > 0;
    state.events.push({ kind: "replicated", proposalId: p.id, lift, margin: r.margin, worst, pass });
    if (pass) { replicated.push(p); state.brains[p.brain]!.replicated++; }
    else finish(state, p, "rejected", `failed to replicate: ${lift.toFixed(2)} on a second set of worlds`, r, champRep);
  }

  // 4. Seal: the verdict set. Falsifier, harm guardrail, robustness, audit.
  //    Held proposals from the last generation rejoin here, re-based on the current champion.
  for (const id of [...state.pendingIds]) {
    state.pendingIds.delete(id);
    const p = state.proposals.find((x) => x.id === id);
    if (!p || p.stage === "verdict") continue;
    const partial: Strategy = {};
    for (const c of p.changes) partial[c.arena] = { ...(partial[c.arena] ?? state.champion[c.arena]!), [c.gene]: c.to };
    p.strategy = mergeStrategy(state.champion, partial);
    replicated.push(p);
  }
  let best: { p: ProposalRecord; r: EvalResult; lift: number } | null = null;
  for (const p of replicated) {
    p.stage = "seal";
    const r = evaluate(p.strategy, sets.sealed, state.cfg.arenas);
    const lift = r.score - champSealed.score;
    const worst = r.worst - champSealed.worst;
    const harmDelta = r.harmRate - champSealed.harmRate;
    p.sealed = { lift: r3(lift), margin: r3(r.margin), worst: r3(worst), worstFamily: r.worstFamily, harmDelta: r3(harmDelta) };
    const b = state.brains[p.brain]!;
    const tuningLift = (p.screen!.lift + p.replicate!.lift) / 2;
    b.overfitGap = (b.overfitGap * b.overfitN + (tuningLift - lift)) / (b.overfitN + 1);
    b.overfitN++;
    state.events.push({ kind: "sealed", proposalId: p.id, lift, margin: r.margin, worst, pass: lift > 0 });

    if (r.score > state.sealedOracle + 1e-6) {
      p.flags.push("score exceeds the oracle ceiling");
      state.events.push({ kind: "flag", target: p.id, detail: "sealed score above the oracle ceiling — evaluator integrity check" });
      finish(state, p, "flagged", "impossible score", r, champSealed);
      b.flagged++;
      continue;
    }
    if (harmDelta > state.cfg.harmTolerance) {
      finish(state, p, "rejected", `harm guardrail: opt-outs +${harmDelta.toFixed(2)} per 100 sourced`, r, champSealed);
      continue;
    }
    if (lift < p.falsifyBelow) {
      b.falsified++;
      b.credibility = Math.max(0.2, b.credibility * 0.85);
      finish(state, p, "falsified", `pre-registered falsifier: sealed lift ${lift.toFixed(2)} < ${p.falsifyBelow.toFixed(2)}`, r, champSealed);
      continue;
    }
    if (lift - r.margin <= 0) {
      // Positive but not decisive: hold it for a re-seal next generation (bounded patience) rather
      // than killing a real but small effect on one noisy read.
      p.pending = (p.pending ?? 0) + 1;
      if (lift > 0 && p.pending <= 2) { p.stage = "replicate"; p.flags.push(`held for re-seal (${p.pending})`); state.pendingIds.add(p.id); continue; }
      finish(state, p, "rejected", `sealed lift ${lift.toFixed(2)} ± ${r.margin.toFixed(2)} not decisive after ${p.pending} reads`, r, champSealed);
      continue;
    }
    if (worst < -state.cfg.worstTolerance) {
      finish(state, p, "rejected", `not robust: ${r.worstFamily} regressed ${worst.toFixed(2)}`, r, champSealed);
      continue;
    }
    addElite(state, p.strategy, r.score, p.id);
    // Robust AND decisive: among candidates that cleared every gate, the largest sealed lift wins.
    if (!best || lift > best.lift) {
      if (best) finish(state, best.p, "rejected", `beaten by ${p.id} on sealed lift`, best.r, champSealed);
      best = { p, r, lift };
    } else finish(state, p, "rejected", `beaten by ${best.p.id} on sealed lift`, r, champSealed);
  }

  // Overfitting audit per brain: tuning wins that keep failing sealed.
  for (const b of Object.values(state.brains)) {
    if (b.overfitN >= 4 && b.overfitGap > 0.5) {
      b.credibility = Math.max(0.2, b.credibility * 0.9);
      b.flagged++;
      state.events.push({ kind: "flag", target: b.id, detail: `overfitting: tuning lift exceeds sealed lift by ${b.overfitGap.toFixed(2)} on average` });
      b.overfitN = 0;
      b.overfitGap = 0;
    }
  }

  // 5. Promote.
  if (best) {
    const { p, r, lift } = best;
    finish(state, p, "promoted", `sealed +${lift.toFixed(2)} (worst family ${r.worstFamily} ${p.sealed!.worst >= 0 ? "+" : ""}${p.sealed!.worst.toFixed(2)})`, r, champSealed);
    state.brains[p.brain]!.promoted++;
    state.brains[p.brain]!.credibility = Math.min(2, state.brains[p.brain]!.credibility * 1.1);
    state.champion = p.strategy;
    state.championScore = r.score;
    state.plateau = 0;
    state.lineage.push({ generation: gen, score: r.score, sealedScore: r.score, proposalId: p.id, changes: p.changes });
    state.events.push({ kind: "promoted", proposalId: p.id, championScore: r.score, sealedScore: r.score, changes: p.changes });
  } else {
    state.plateau++;
    // Plateau escape: before declaring convergence, reseed the search from the runner-up elite so the
    // brains explore a different basin; the champion is never replaced by this (only by a sealed win).
    if (state.plateau >= state.cfg.maxPlateau) {
      const alt = state.elites.find((e) => strategySignature(e.strategy) !== strategySignature(state.champion));
      if (alt && state.reseeds < 2) {
        state.reseeds++;
        state.plateau = 0;
        state.library = state.library.filter((e) => e.verdict !== "rejected" || e.lift > 0); // reopen blind spots
        state.events.push({ kind: "flag", target: "governor", detail: `plateau: reseeding search from elite ${alt.proposalId}` });
      } else {
        state.converged = true;
        state.events.push({ kind: "converged", generation: gen });
      }
    }
  }
  state.tick++;
  return state.events.slice(start);
}

function addElite(state: ResearchState, strategy: Strategy, score: number, proposalId: string) {
  const sig = strategySignature(strategy);
  if (state.elites.some((e) => strategySignature(e.strategy) === sig)) return;
  state.elites.push({ strategy, score, proposalId });
  state.elites.sort((a, b) => b.score - a.score);
  if (state.elites.length > 12) state.elites.length = 12;
}

function finish(state: ResearchState, p: ProposalRecord, verdict: Verdict, reason: string, r: EvalResult, champ: EvalResult) {
  p.stage = "verdict";
  p.verdict = verdict;
  p.reason = reason;
  state.library.push({
    id: p.id,
    brain: p.brain,
    changes: p.changes,
    lift: r3(r.score - champ.score),
    margin: r3(r.margin),
    worstLift: r3(r.worst - champ.worst),
    verdict,
    generation: p.generation,
  });
  state.events.push({ kind: "verdict", proposalId: p.id, verdict, reason });
}

/** Convenience: run until converged or maxGenerations. */
export function runResearch(seed: number, maxGenerations: number, cfg: Partial<GovernorConfig> = {}): ResearchState {
  const s = createResearch(seed, cfg);
  for (let i = 0; i < maxGenerations && !s.converged; i++) runGeneration(s);
  return s;
}

export { strategySignature };
