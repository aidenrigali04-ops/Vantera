/**
 * Rules-only versus rules plus the deliberator, to exhaustion.
 *
 *   pnpm --filter @vantera/agent-brains hive:compare
 *
 * The deliberator stays only if it raises mean percent-of-oracle by at least 3 points, or cuts
 * generations to exhaustion by at least 20% at an equal-or-better percent-of-oracle, AND false
 * promotions on no_winner runs stay at 0. Thresholds are fixed. Do not tune them to pass.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getModel } from "@vantera/ai";
import type { Family } from "../hive/sim/world";
import { makeDeliberator, tokenCostUsd } from "./deliberator";
import { createResearch, runGeneration, type ResearchOptions } from "./governor";

const SEARCH_SEEDS = [11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
const QUIET_SEEDS = [21, 22, 23, 24, 25];
const ORACLE_GAIN_POINTS = 3;
const GENERATION_CUT = 0.2;

export type ArmRun = {
  seed: number;
  generations: number;
  pctOfOracle: number;
  proposals: number;
  wallMs: number;
  llmUsd: number;
  converged: boolean;
};

export function meanSd(xs: number[]): { mean: number; sd: number } {
  if (!xs.length) return { mean: 0, sd: 0 };
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  const variance = xs.reduce((a, b) => a + (b - mean) ** 2, 0) / (xs.length > 1 ? xs.length - 1 : 1);
  return { mean, sd: Math.sqrt(variance) };
}

export function judgeDeliberator(input: {
  rulesPct: number;
  deliberatorPct: number;
  rulesGenerations: number;
  deliberatorGenerations: number;
  falsePromotions: number;
}): { stay: boolean; reason: string } {
  const gain = input.deliberatorPct - input.rulesPct;
  const cut = input.rulesGenerations > 0 ? (input.rulesGenerations - input.deliberatorGenerations) / input.rulesGenerations : 0;
  const lifted = gain >= ORACLE_GAIN_POINTS;
  const quicker = cut >= GENERATION_CUT && input.deliberatorPct >= input.rulesPct;
  const numbers = `oracle ${input.deliberatorPct.toFixed(2)}% vs ${input.rulesPct.toFixed(2)}% (${gain >= 0 ? "+" : ""}${gain.toFixed(2)} points), generations ${input.deliberatorGenerations.toFixed(1)} vs ${input.rulesGenerations.toFixed(1)}, false promotions ${input.falsePromotions}`;
  if (input.falsePromotions !== 0) return { stay: false, reason: `deliberator rejected: ${numbers}` };
  if (lifted || quicker) return { stay: true, reason: `deliberator stays: ${numbers}` };
  return { stay: false, reason: `deliberator rejected: ${numbers}` };
}

async function exhaust(seed: number, families: Family[] | undefined, options: ResearchOptions, usage?: { usd: () => number }): Promise<ArmRun> {
  const t0 = Date.now();
  const state = createResearch(seed, { continuous: true, ...(families ? { families } : {}) }, options);
  let guard = 0;
  while (!state.converged && guard < 500) {
    await runGeneration(state);
    guard++;
  }
  const pct = state.sealedOracle > 0 ? (100 * state.championScore) / state.sealedOracle : 0;
  return {
    seed,
    generations: state.generation,
    pctOfOracle: pct,
    proposals: state.proposals.length,
    wallMs: Date.now() - t0,
    llmUsd: usage?.usd() ?? 0,
    converged: state.converged,
  };
}

async function countPromotions(seed: number, options: ResearchOptions): Promise<number> {
  const state = createResearch(seed, { continuous: true, families: ["no_winner"] }, options);
  let guard = 0;
  while (!state.converged && guard < 500) {
    await runGeneration(state);
    guard++;
  }
  return state.lineage.length - 1;
}

function line(label: string, xs: number[], digits = 2): string {
  const { mean, sd } = meanSd(xs);
  return `| ${label} | ${mean.toFixed(digits)} | ${sd.toFixed(digits)} |`;
}

function report(rules: ArmRun[], withModel: ArmRun[], quietRules: number, quietModel: number): string {
  const judged = judgeDeliberator({
    rulesPct: meanSd(rules.map((r) => r.pctOfOracle)).mean,
    deliberatorPct: meanSd(withModel.map((r) => r.pctOfOracle)).mean,
    rulesGenerations: meanSd(rules.map((r) => r.generations)).mean,
    deliberatorGenerations: meanSd(withModel.map((r) => r.generations)).mean,
    falsePromotions: quietModel,
  });
  const seeds = (rows: ArmRun[]) => rows.map((r) => `| ${r.seed} | ${r.generations} | ${r.pctOfOracle.toFixed(1)} | ${r.proposals} | ${(r.wallMs / 1000).toFixed(1)} | ${r.llmUsd.toFixed(4)} | ${r.converged ? "yes" : "no"} |`).join("\n");
  return `# Hive compare ${new Date().toISOString()}

Thresholds, fixed: stay only if mean percent-of-oracle rises by ≥ ${ORACLE_GAIN_POINTS} points, or generations to exhaustion fall by ≥ ${GENERATION_CUT * 100}% at an equal-or-better percent-of-oracle, and false promotions on no_winner runs are 0.

## Rules only

| metric | mean | sd |
| --- | --- | --- |
${line("generations to exhaustion", rules.map((r) => r.generations), 1)}
${line("champion, % of oracle", rules.map((r) => r.pctOfOracle))}
${line("proposals", rules.map((r) => r.proposals), 1)}
${line("wall time, seconds", rules.map((r) => r.wallMs / 1000))}
${line("LLM cost, USD", rules.map((r) => r.llmUsd), 4)}

## Rules + deliberator

| metric | mean | sd |
| --- | --- | --- |
${line("generations to exhaustion", withModel.map((r) => r.generations), 1)}
${line("champion, % of oracle", withModel.map((r) => r.pctOfOracle))}
${line("proposals", withModel.map((r) => r.proposals), 1)}
${line("wall time, seconds", withModel.map((r) => r.wallMs / 1000))}
${line("LLM cost, USD", withModel.map((r) => r.llmUsd), 4)}

## False promotions on no_winner (seeds 21–25)

| arm | promotions |
| --- | --- |
| rules only | ${quietRules} |
| rules + deliberator | ${quietModel} |

## Verdict

${judged.reason}

## Per seed, rules only

| seed | generations | % of oracle | proposals | seconds | USD | exhausted |
| --- | --- | --- | --- | --- | --- | --- |
${seeds(rules)}

## Per seed, rules + deliberator

| seed | generations | % of oracle | proposals | seconds | USD | exhausted |
| --- | --- | --- | --- | --- | --- | --- |
${seeds(withModel)}
`;
}

async function main() {
  const model = getModel();
  const rules: ArmRun[] = [];
  const withModel: ArmRun[] = [];
  for (const seed of SEARCH_SEEDS) {
    console.log(`rules seed ${seed}`);
    rules.push(await exhaust(seed, undefined, {}));
    const brain = makeDeliberator(model);
    console.log(`deliberator seed ${seed}`);
    const run = await exhaust(seed, undefined, { brains: { deliberator: brain } }, { usd: () => tokenCostUsd(brain.usage) });
    withModel.push(run);
    console.log(`  rules ${rules[rules.length - 1]!.pctOfOracle.toFixed(1)}% in ${rules[rules.length - 1]!.generations} gens; deliberator ${run.pctOfOracle.toFixed(1)}% in ${run.generations} gens, $${run.llmUsd.toFixed(4)}`);
  }
  let quietRules = 0;
  let quietModel = 0;
  for (const seed of QUIET_SEEDS) {
    console.log(`no_winner seed ${seed}`);
    quietRules += await countPromotions(seed, {});
    const brain = makeDeliberator(model);
    quietModel += await countPromotions(seed, { brains: { deliberator: brain } });
  }
  const text = report(rules, withModel, quietRules, quietModel);
  const root = process.cwd().endsWith("agent-brains") ? join(process.cwd(), "../..") : process.cwd();
  const dir = join(root, "hive-results");
  mkdirSync(dir, { recursive: true });
  const path = join(dir, `compare-${new Date().toISOString().slice(0, 10)}.md`);
  writeFileSync(path, text);
  console.log(text);
  console.log(`wrote ${path}`);
}

function invokedDirectly(): boolean {
  const entry = process.argv[1] ?? "";
  return entry.endsWith("compare.ts") || entry.endsWith("compare.js");
}

if (invokedDirectly()) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
