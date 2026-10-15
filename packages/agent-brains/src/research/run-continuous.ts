import { ARENAS, type ArenaKey } from "../hive/arenas";
import { createResearch, runGeneration, type GovernorConfig, type ResearchState } from "./governor";

/**
 * Continuous research: run the hive across every aspect (prospecting, intent, qualification,
 * outreach first touch, outreach follow-ups, conversation, closing) until the Governor declares it
 * cannot be optimized further — i.e. a full plateau after every reseed, with no untested
 * single-change idea left in any brain. `maxGenerations` is a hard safety stop only.
 *
 * Pure apart from the optional `onGeneration` hook (for streaming progress to a log or a UI).
 */
export type ContinuousOptions = {
  seed: number;
  cfg?: Partial<GovernorConfig>;
  /** hard stop; convergence normally ends the run well before this */
  maxGenerations?: number;
  onGeneration?: (state: ResearchState) => void;
};

export type ContinuousReport = {
  seed: number;
  generations: number;
  converged: boolean;
  reseeds: number;
  startScore: number;
  finalScore: number;
  oracleCeiling: number;
  /** share of the (oracle − start) gap the hive closed */
  gapClosed: number;
  champion: ResearchState["champion"];
  lineage: ResearchState["lineage"];
  brains: ResearchState["brains"];
  verdicts: Record<string, number>;
  /** which aspects the final champion changed from its defaults */
  changedArenas: ArenaKey[];
};

export function runContinuous(opts: ContinuousOptions): { state: ResearchState; report: ContinuousReport } {
  const state = createResearch(opts.seed, opts.cfg);
  const max = opts.maxGenerations ?? 200;
  for (let i = 0; i < max && !state.converged; i++) {
    runGeneration(state);
    opts.onGeneration?.(state);
  }
  return { state, report: reportOf(state) };
}

export function reportOf(state: ResearchState): ContinuousReport {
  const start = state.lineage[0]!.sealedScore;
  const verdicts: Record<string, number> = {};
  for (const p of state.proposals) verdicts[p.verdict ?? "pending"] = (verdicts[p.verdict ?? "pending"] ?? 0) + 1;
  const changedArenas = (Object.keys(ARENAS) as ArenaKey[]).filter((a) => {
    const g = state.champion[a];
    if (!g) return false;
    return Object.entries(ARENAS[a].genes).some(([k, spec]) => g[k] !== spec.default);
  });
  const gap = state.sealedOracle - start;
  return {
    seed: state.seed,
    generations: state.generation,
    converged: state.converged,
    reseeds: state.reseeds,
    startScore: start,
    finalScore: state.championScore,
    oracleCeiling: state.sealedOracle,
    gapClosed: gap > 1e-9 ? (state.championScore - start) / gap : 0,
    champion: state.champion,
    lineage: state.lineage,
    brains: state.brains,
    verdicts,
    changedArenas,
  };
}
