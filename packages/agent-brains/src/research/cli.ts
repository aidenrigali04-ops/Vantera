import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ARENAS } from "../hive/arenas";
import { createResearch, runGeneration, untestedMoves, type ResearchState } from "./governor";

/**
 * Run The Hive from a terminal until it can't be optimized any more (exhaustion), writing the
 * champion, lineage, brain scorecards and the full verdict library to a results folder.
 *
 *   pnpm --filter @vantera/agent-brains hive            # defaults: seed 11
 *   pnpm --filter @vantera/agent-brains hive -- --seed 42 --proposals 12 --out ./hive-results
 *
 * No real data, no network, no sends: everything runs against hidden synthetic worlds.
 */

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1]! : fallback;
}

const seed = Number(arg("seed", "11"));
const proposalsPerGeneration = Number(arg("proposals", "8"));
const maxGenerations = Number(arg("max-generations", "500"));
const out = arg("out", join(process.cwd(), "hive-results"));

const state: ResearchState = createResearch(seed, { proposalsPerGeneration, continuous: true });
const t0 = Date.now();
const pct = (s: ResearchState) => ((100 * s.championScore) / s.sealedOracle).toFixed(0);

console.log(`The Hive · seed ${seed} · ${Object.keys(ARENAS).length} arenas · oracle ceiling ${state.sealedOracle.toFixed(3)}`);
console.log(`gen 0  champion ${state.championScore.toFixed(3)} (${pct(state)}% of ceiling)`);

let gen = 0;
while (!state.converged && gen < maxGenerations) {
  const events = runGeneration(state);
  gen++;
  const promoted = events.find((e) => e.kind === "promoted");
  const flags = events.filter((e) => e.kind === "flag").length;
  const line = promoted
    ? `NEW CHAMPION ${state.championScore.toFixed(3)} (${pct(state)}%) ← ${promoted.changes.map((c) => `${c.arena}.${c.gene}=${c.to}`).join(", ")}`
    : `held · ${untestedMoves(state).length} untested moves · ${state.plateau} since last win`;
  console.log(`gen ${String(gen).padStart(3)}  ${line}${flags ? ` · ${flags} flag(s)` : ""}`);
}

console.log(state.converged ? `converged: exhausted after ${gen} generations` : `stopped at the ${maxGenerations}-generation cap`);
console.log(`champion ${state.championScore.toFixed(3)} of ceiling ${state.sealedOracle.toFixed(3)} (${pct(state)}%) · ${state.proposals.length} proposals · ${((Date.now() - t0) / 1000).toFixed(1)}s`);

mkdirSync(out, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const base = join(out, `hive-seed${seed}-${stamp}`);
writeFileSync(`${base}.champion.json`, JSON.stringify({ seed, generation: gen, converged: state.converged, championScore: state.championScore, oracle: state.sealedOracle, champion: state.champion, lineage: state.lineage }, null, 2));
writeFileSync(`${base}.brains.json`, JSON.stringify(state.brains, null, 2));
writeFileSync(`${base}.library.json`, JSON.stringify(state.library, null, 2));
writeFileSync(`${base}.proposals.json`, JSON.stringify(state.proposals.map((p) => ({ ...p, strategy: undefined })), null, 2));
console.log(`wrote ${base}.{champion,brains,library,proposals}.json`);
