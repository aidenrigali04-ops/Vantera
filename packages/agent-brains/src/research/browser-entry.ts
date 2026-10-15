/**
 * Browser bundle entry for the Research Hive viewer: the real governor + brains, no I/O.
 * Built with `esbuild --bundle --format=iife --global-name=Hive` (see research/README.md).
 */
export { createResearch, runGeneration, GOVERNOR_DEFAULTS } from "./governor";
export { BRAIN_DESCRIPTION, BRAIN_KINDS } from "./brains";
export { ARENAS } from "../hive/arenas";

import type { ResearchState } from "./governor";

/** JSON-safe snapshot for the viewer (Sets/Maps flattened). */
export function snapshot(s: ResearchState) {
  return {
    seed: s.seed,
    generation: s.generation,
    plateau: s.plateau,
    converged: s.converged,
    reseeds: s.reseeds,
    champion: s.champion,
    championScore: s.championScore,
    sealedOracle: s.sealedOracle,
    lineage: s.lineage,
    brains: s.brains,
    proposals: s.proposals.map((p) => ({ ...p, strategy: undefined })),
    elites: s.elites.map((e) => ({ score: e.score, proposalId: e.proposalId })),
    librarySize: s.library.length,
    cfg: { proposalsPerGeneration: s.cfg.proposalsPerGeneration, maxPlateau: s.cfg.maxPlateau, harmTolerance: s.cfg.harmTolerance, worstTolerance: s.cfg.worstTolerance, sealedWorldsPerFamily: s.cfg.sealedWorldsPerFamily },
  };
}
