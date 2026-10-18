import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getModel } from "@vantera/ai";
import { ARENAS } from "../hive/arenas";
import { makeDeliberator, tokenCostUsd, type TokenUsage } from "./deliberator";
import { createResearch, runGeneration, untestedMoves, type ResearchState } from "./governor";

/**
 * Run The Hive from a terminal until it can't be optimized any more (exhaustion), writing the
 * champion, lineage, brain scorecards and the full verdict library to a results folder.
 *
 *   pnpm --filter @vantera/agent-brains hive            # defaults: seed 11, five rule brains
 *   pnpm --filter @vantera/agent-brains hive -- --seed 42 --proposals 12 --out ./hive-results
 *   pnpm --filter @vantera/agent-brains hive -- --seed 11 --llm
 *
 * --llm registers the deliberator with getModel(). Without it, nothing about the search changes.
 * No real data and no sends: everything runs against hidden synthetic worlds.
 */

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1]! : fallback;
}

const seed = Number(arg("seed", "11"));
const proposalsPerGeneration = Number(arg("proposals", "8"));
const maxGenerations = Number(arg("max-generations", "500"));
const out = arg("out", join(process.cwd(), "hive-results"));
const llm = process.argv.includes("--llm");
const deliberator = llm ? makeDeliberator(getModel()) : null;

const state: ResearchState = createResearch(
  seed,
  { proposalsPerGeneration, continuous: true },
  deliberator ? { brains: { deliberator } } : {},
);
const t0 = Date.now();
const pct = (s: ResearchState) => ((100 * s.championScore) / s.sealedOracle).toFixed(0);

console.log(`The Hive · seed ${seed} · ${Object.keys(ARENAS).length} arenas · oracle ceiling ${state.sealedOracle.toFixed(3)}${llm ? " · deliberator on" : ""}`);
console.log(`gen 0  champion ${state.championScore.toFixed(3)} (${pct(state)}% of ceiling)`);

let gen = 0;
while (!state.converged && gen < maxGenerations) {
  const events = await runGeneration(state);
  gen++;
  const promoted = events.find((e) => e.kind === "promoted");
  const flags = events.filter((e) => e.kind === "flag").length;
  const winner = promoted ? state.proposals.find((p) => p.id === promoted.proposalId)?.brain : undefined;
  const line = promoted
    ? `NEW CHAMPION ${state.championScore.toFixed(3)} (${pct(state)}%) ← ${winner ?? "unknown"} · ${promoted.changes.map((c) => `${c.arena}.${c.gene}=${c.to}`).join(", ")}`
    : `held · ${untestedMoves(state).length} untested moves · ${state.plateau} since last win`;
  console.log(`gen ${String(gen).padStart(3)}  ${line}${flags ? ` · ${flags} flag(s)` : ""}`);
}

console.log(state.converged ? `converged: exhausted after ${gen} generations` : `stopped at the ${maxGenerations}-generation cap`);
console.log(`champion ${state.championScore.toFixed(3)} of ceiling ${state.sealedOracle.toFixed(3)} (${pct(state)}%) · ${state.proposals.length} proposals · ${((Date.now() - t0) / 1000).toFixed(1)}s`);
printScorecard(state, deliberator?.usage ?? null);

mkdirSync(out, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const base = join(out, `hive-seed${seed}-${stamp}`);
writeFileSync(`${base}.champion.json`, JSON.stringify({ seed, generation: gen, converged: state.converged, championScore: state.championScore, oracle: state.sealedOracle, champion: state.champion, lineage: state.lineage }, null, 2));
writeFileSync(`${base}.brains.json`, JSON.stringify(state.brains, null, 2));
writeFileSync(`${base}.library.json`, JSON.stringify(state.library, null, 2));
writeFileSync(`${base}.proposals.json`, JSON.stringify(state.proposals.map((p) => ({ ...p, strategy: undefined })), null, 2));
console.log(`wrote ${base}.{champion,brains,library,proposals}.json`);

function printScorecard(s: ResearchState, usage: TokenUsage | null) {
  const header = ["brain", "proposed", "invalid", "screen", "replicated", "promoted", "falsified", "flagged", "cred"];
  console.log(`\n${header.join("\t")}`);
  for (const b of Object.values(s.brains)) {
    console.log([b.kind, b.proposed, b.invalid, b.passedScreen, b.replicated, b.promoted, b.falsified, b.flagged, b.credibility.toFixed(2)].join("\t"));
  }
  if (usage) {
    console.log(`deliberator tokens  in ${usage.inputTokens}  out ${usage.outputTokens}  calls ${usage.calls}  estimated $${tokenCostUsd(usage).toFixed(4)} at $${3}/M input and $${15}/M output`);
  }
}
