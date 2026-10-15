/**
 * CLI: run the research hive continuously until the Governor says it can't be optimized further.
 *
 *   pnpm --filter @vantera/agent-brains hive                 # seed 11
 *   pnpm --filter @vantera/agent-brains hive -- --seed 42 --proposals 10 --out report.json
 *
 * Prints one line per generation and writes a JSON report (champion, lineage, brain records).
 */
import { writeFileSync } from "node:fs";
import { runContinuous } from "../src/research/run-continuous";

const args = process.argv.slice(2);
const flag = (name: string, fallback: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1]! : fallback;
};
const seed = Number(flag("seed", "11"));
const proposals = Number(flag("proposals", "8"));
const maxGenerations = Number(flag("max", "200"));
const out = flag("out", `hive-report-${seed}.json`);

const t0 = Date.now();
const { report } = runContinuous({
  seed,
  cfg: { proposalsPerGeneration: proposals },
  maxGenerations,
  onGeneration: (s) => {
    const last = s.lineage[s.lineage.length - 1]!;
    const won = last.generation === s.generation;
    console.log(
      `gen ${String(s.generation).padStart(3)}  champion ${s.championScore.toFixed(3)} / oracle ${s.sealedOracle.toFixed(3)}` +
        (won ? `  PROMOTED ${last.changes.map((c) => `${c.arena}.${c.gene}=${c.to}`).join(", ")}` : `  plateau ${s.plateau}`)
    );
  },
});

console.log(
  `\n${report.converged ? "Converged" : "Stopped at the hard limit"} after ${report.generations} generations in ${((Date.now() - t0) / 1000).toFixed(1)}s` +
    `\nchampion ${report.startScore.toFixed(3)} → ${report.finalScore.toFixed(3)} (oracle ${report.oracleCeiling.toFixed(3)}, ${(report.gapClosed * 100).toFixed(0)}% of the gap closed)` +
    `\naspects changed: ${report.changedArenas.join(", ") || "none"}` +
    `\nverdicts: ${JSON.stringify(report.verdicts)}`
);
writeFileSync(out, JSON.stringify(report, null, 2));
console.log(`report written to ${out}`);
