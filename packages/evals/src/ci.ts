import { pathToFileURL } from "node:url";
import type { LanguageModel } from "ai";
import { draftLinkedIn, draftConversationMessage } from "@vantera/agent-brains";
import { getModel } from "@vantera/ai";
import { loadCopyLinkedinCorpus, loadCopyRespondCorpus } from "./corpus";
import { runDeterministic } from "./run-deterministic";
import { runReplyFloors, runIntentFloors, runIntentHardFloors, runRankFloors } from "./run-classifier";
import type { FloorReport } from "./graders/classifier";
import { runPairwise, PAIRWISE_NONINFERIORITY, type PairwiseReport } from "./judge/pairwise";
import { judgeCopy, JUDGE_MODEL_ID } from "./judge/judge";

/**
 * The live-evals CI entry point (Phase 2B, Task 8) — what `evals.yml` runs as
 * `pnpm --filter @vantera/evals evals:ci` (via `tsx`, see `package.json`'s `evals:ci` script).
 *
 * Three layers, two postures:
 * - HARD (fail the build): the deterministic copy gate (Task 4, `runDeterministic("live")`,
 *   `passRate >= DETERMINISTIC_LIVE_FLOOR`, see that const's doc for why this isn't exact 100%)
 *   and the classifier accuracy floors (Task 5 + 8.0 rank/hard-intent, `runReplyFloors` +
 *   `runIntentFloors` + `runIntentHardFloors` + `runRankFloors`, every `FloorReport.pass`).
 * - ADVISORY (report, never fail): the LLM judge (Task 6) and the pairwise win-rate harness
 *   (Task 7) — both are informational until a human owner labels ~100 drafts, runs
 *   `runCalibration` (`./judge/kappa.ts`), confirms Cohen's kappa >= 0.7, and flips
 *   `EVALS_JUDGE_GATING=1` in the environment. That flag is read here (`judgeGating`) and — the
 *   ONLY thing it changes — routes the same two advisory findings (pairwise non-inferiority,
 *   judge average-overall) into the hard-failure list instead of the advisory-only list. See
 *   `docs/evals.md` for the full calibration procedure; `runCalibration` itself is a manual,
 *   local step the owner runs against the filled `fixtures/judge-calibration/human-labels.json` —
 *   this file does not call it.
 *
 * `decide()` is the pure decision function: given already-computed results, it returns the exit
 * code and the human-readable reasons, with ZERO I/O and ZERO `process.exit` — this is what
 * `ci.test.ts` exercises directly with hand-built fixtures (no network, no model, runs in the
 * normal fast `pnpm --filter @vantera/evals test` suite). `orchestrate()` is one layer up: it
 * sequences the run-fns (real or, in tests, injected fakes) and folds their results through
 * `decide()`. Only `main()` touches `process.env`/`process.exit`/real model calls.
 */

/**
 * Provisional floor for the judge's average `overall` score (1-5 scale, see `./judge/judge.ts`).
 * Unlike `PAIRWISE_NONINFERIORITY` (Task 7, locked) or the classifier floors (Task 5, locked),
 * this number has no calibration study behind it yet — it exists only so `EVALS_JUDGE_GATING=1`
 * has SOMETHING concrete to gate the judge on. Revisit (or replace with a calibration-derived
 * threshold) at flip time, per `docs/evals.md`.
 */
export const JUDGE_OVERALL_GATE_FLOOR = 3.5;

/**
 * The hard-gate floor for `runDeterministic("live")`'s passRate. NOT 1 (exact 100%) — `"live"`
 * mode regenerates a fresh draft per corpus case via the real drafting brains, which is a
 * STOCHASTIC process: `draftLinkedIn`/`draftConversationMessage` already run `generateHumanized`
 * (generate → validate → ONE bounded regenerate) internally, so a case only shows up dirty here
 * if it's still lint-dirty after that production regenerate — and in PRODUCTION that's exactly
 * what routes a draft to human review, never a silent send. At the observed ~1% per-draft
 * lint-dirty-after-regenerate rate, P(>=1 dirty in the 36-case corpus) is roughly 30%, so a
 * `passRate === 1` gate was failing ~1 in 3 unrelated PRs on pure variance — "1 of 36 needed
 * review" is normal production behavior, not a defect, and shouldn't block a build.
 *
 * 0.9 tolerates up to ~3 stochastic review-routed drafts out of 36 (matching the observed
 * per-draft variance with headroom) while a genuine prompt/copy regression — which dirties drafts
 * systematically, not by chance — tanks passRate well below this floor (the mock-model regression
 * test in `graders/deterministic.test.ts` demonstrates a real regression drives passRate to 0, not
 * to 0.9-ish). This is a coarse, revisitable number, not a calibration-study output like
 * `PAIRWISE_NONINFERIORITY` — tighten or loosen it if the corpus size or the observed per-draft
 * lint-dirty rate materially changes.
 */
export const DETERMINISTIC_LIVE_FLOOR = 0.9;

export type DeterministicFailure = { caseId: string; rules: string[] };
export type DeterministicSummary = { passRate: number; failures?: DeterministicFailure[] };
export type JudgeSummary = { averageOverall: number; n: number };

export type CiInputs = {
  deterministic: DeterministicSummary;
  floors: FloorReport[];
  pairwise: PairwiseReport;
  judge: JudgeSummary;
  /** `process.env.EVALS_JUDGE_GATING === "1"` — the post-calibration flip (see module doc). */
  judgeGating: boolean;
};

export type CiDecision = {
  exitCode: 0 | 1;
  /** Non-empty iff `exitCode === 1` — these are what actually failed the build. */
  hardFailures: string[];
  /** Judge/pairwise misses reported for visibility but NOT gating. Populated only when
   *  `judgeGating` is false — when gating is on, the same misses route into `hardFailures`
   *  instead (never both). So pre-calibration a judge/pairwise miss is always visible here;
   *  post-flip it becomes a hard failure and this list stays empty for that metric. */
  advisoryFlags: string[];
};

/**
 * Pure decision logic — no I/O, no `process.exit`. Hard gates (deterministic passRate, every
 * classifier floor) always fail the build on a miss. Judge + pairwise misses go to
 * `advisoryFlags` UNLESS `judgeGating` is true, in which case they ALSO land in `hardFailures`
 * (and therefore flip `exitCode`). A judge summary with `n === 0` (no live candidates were
 * scored) is never treated as a miss either way — there is nothing to judge.
 *
 * The deterministic gate fails on `passRate < DETERMINISTIC_LIVE_FLOOR` (0.9), not `< 1` — see
 * that const's doc. Production routes a lint-dirty draft to human review, it never blocks or
 * auto-sends it, so a small fraction of review-routed drafts among freshly-generated live samples
 * is expected variance, not a defect; only a SYSTEMATIC lint-violation rate (passRate dropping
 * below the floor) signals a real prompt/copy regression worth failing the build over. When the
 * caller supplies `inputs.deterministic.failures` (the per-case `{caseId, rules}` list), a miss's
 * message names the failing case(s) and their violation rules so a reproducible borderline
 * fixture can be told apart from pure sampling variance at a glance.
 */
export function decide(inputs: CiInputs): CiDecision {
  const hardFailures: string[] = [];
  const advisoryFlags: string[] = [];

  if (inputs.deterministic.passRate < DETERMINISTIC_LIVE_FLOOR) {
    const failures = inputs.deterministic.failures ?? [];
    const caseDetail =
      failures.length > 0
        ? ` — failing case(s): ${failures.map((f) => `${f.caseId} [${f.rules.join(", ")}]`).join("; ")}`
        : "";
    hardFailures.push(
      `deterministic copy gate (HARD): passRate ${inputs.deterministic.passRate.toFixed(3)} < floor ${DETERMINISTIC_LIVE_FLOOR} — systematic lint-violation rate, not stochastic review-routing${caseDetail}`
    );
  }

  for (const floor of inputs.floors) {
    if (!floor.pass) {
      hardFailures.push(
        `classifier floor miss (HARD): ${floor.metric} = ${floor.value.toFixed(3)} < floor ${floor.floor} (n=${floor.n})`
      );
    }
  }

  if (!inputs.pairwise.nonInferior) {
    const msg = `pairwise non-inferiority miss: winRate ${inputs.pairwise.winRate.toFixed(3)} < ${PAIRWISE_NONINFERIORITY} (candidateWins=${inputs.pairwise.candidateWins} baselineWins=${inputs.pairwise.baselineWins} ties=${inputs.pairwise.ties})`;
    if (inputs.judgeGating) hardFailures.push(`${msg} [GATING: EVALS_JUDGE_GATING=1]`);
    else advisoryFlags.push(msg);
  }

  if (inputs.judge.n > 0 && inputs.judge.averageOverall < JUDGE_OVERALL_GATE_FLOOR) {
    const msg = `judge average-overall miss: ${inputs.judge.averageOverall.toFixed(2)} < floor ${JUDGE_OVERALL_GATE_FLOOR} (n=${inputs.judge.n})`;
    if (inputs.judgeGating) hardFailures.push(`${msg} [GATING: EVALS_JUDGE_GATING=1]`);
    else advisoryFlags.push(msg);
  }

  return { exitCode: hardFailures.length === 0 ? 0 : 1, hardFailures, advisoryFlags };
}

/** `true` when `ANTHROPIC_API_KEY` is absent — the loud-skip condition. Pure, so it's testable
 *  without touching real `process.env`. Takes a minimal structural type (rather than
 *  `NodeJS.ProcessEnv`, whose index signature doesn't structurally satisfy a `Pick` of one named
 *  key) so both a hand-built test fixture and the real `process.env` are assignable. */
export function shouldSkipLiveEvals(env: { ANTHROPIC_API_KEY?: string }): boolean {
  return !env.ANTHROPIC_API_KEY;
}

type LiveCandidate = { caseId: string; text: string; grounding: string; cta?: string };

/**
 * One live draft per corpus case (both `copy-linkedin` and `copy-respond`), via the SAME
 * production brains `runDeterministic("live")` calls internally. This is a SEPARATE generation
 * pass from `runDeterministic`'s — that function only returns pass/fail `GradeResult`s, never the
 * draft text, so there's no way to reuse its drafts for the judge/pairwise steps without changing
 * its public shape (out of scope here — a named follow-up, see docs/evals.md). Cost-wise this
 * means one extra generation call per fixture beyond the deterministic gate's own pass; kept as
 * ONE shared pass here (not two) so the judge step and the pairwise step never generate twice.
 */
async function generateLiveCandidates(model: LanguageModel): Promise<LiveCandidate[]> {
  const linkedinCases = loadCopyLinkedinCorpus();
  const respondCases = loadCopyRespondCorpus();
  const out: LiveCandidate[] = [];

  for (const c of linkedinCases) {
    const draft = await draftLinkedIn(c.input, model);
    out.push({
      caseId: c.id,
      text: `${draft.connectionNote}\n${draft.followupMessage}`,
      grounding: c.grounding,
      cta: c.input.context.cta,
    });
  }
  for (const c of respondCases) {
    const draft = await draftConversationMessage(c.input, model);
    out.push({ caseId: c.id, text: draft.message, grounding: c.grounding, cta: c.input.context.cta });
  }
  return out;
}

async function scoreJudge(candidates: LiveCandidate[], judgeModel: LanguageModel): Promise<JudgeSummary> {
  if (candidates.length === 0) return { averageOverall: 0, n: 0 };
  let sum = 0;
  for (const c of candidates) {
    const verdict = await judgeCopy({ text: c.text }, { grounding: c.grounding, cta: c.cta }, judgeModel);
    sum += verdict.overall;
  }
  return { averageOverall: sum / candidates.length, n: candidates.length };
}

/** Injectable seams for `orchestrate()` — `main()` wires the real functions; `ci.test.ts` wires
 *  fakes so the orchestration wiring (not just `decide()` in isolation) is under test with zero
 *  network/model calls. */
export type CiDeps = {
  runDeterministic: () => Promise<DeterministicSummary>;
  runReplyFloors: () => Promise<FloorReport[]>;
  runIntentFloors: () => Promise<FloorReport[]>;
  runIntentHardFloors: () => Promise<FloorReport[]>;
  runRankFloors: () => Promise<FloorReport[]>;
  generateLiveCandidates: () => Promise<LiveCandidate[]>;
  runPairwise: (candidates: { caseId: string; text: string }[]) => Promise<PairwiseReport>;
  scoreJudge: (candidates: LiveCandidate[]) => Promise<JudgeSummary>;
};

export type OrchestrationResult = {
  decision: CiDecision;
  deterministic: DeterministicSummary;
  floors: FloorReport[];
  pairwise: PairwiseReport;
  judge: JudgeSummary;
};

/** Sequences the run-fns and folds their results through `decide()`. No `process.exit` — callers
 *  (real: `main()`; tests: `ci.test.ts`) decide what to do with the result. */
export async function orchestrate(deps: CiDeps, judgeGating: boolean): Promise<OrchestrationResult> {
  const deterministic = await deps.runDeterministic();
  const floors = [
    ...(await deps.runReplyFloors()),
    ...(await deps.runIntentFloors()),
    ...(await deps.runIntentHardFloors()),
    ...(await deps.runRankFloors()),
  ];
  const candidates = await deps.generateLiveCandidates();
  const pairwise = await deps.runPairwise(candidates.map(({ caseId, text }) => ({ caseId, text })));
  const judge = await deps.scoreJudge(candidates);

  const decision = decide({ deterministic, floors, pairwise, judge, judgeGating });
  return { decision, deterministic, floors, pairwise, judge };
}

function printSummary(result: OrchestrationResult, judgeGating: boolean): void {
  const { decision, deterministic, floors, pairwise, judge } = result;
  console.log("=== Evals CI summary ===");
  console.log(`deterministic (HARD): passRate=${deterministic.passRate.toFixed(3)} floor=${DETERMINISTIC_LIVE_FLOOR}`);
  if (deterministic.failures && deterministic.failures.length > 0) {
    console.log(`  review-routed/dirty case(s) this run (${deterministic.failures.length}):`);
    for (const f of deterministic.failures) {
      console.log(`    - ${f.caseId}: ${f.rules.join(", ")}`);
    }
  }
  for (const f of floors) {
    console.log(`classifier floor (HARD): ${f.metric}=${f.value.toFixed(3)} floor=${f.floor} pass=${f.pass} n=${f.n}`);
  }
  console.log(
    `pairwise (${judgeGating ? "HARD — EVALS_JUDGE_GATING=1" : "advisory"}): winRate=${pairwise.winRate.toFixed(3)} nonInferior=${pairwise.nonInferior} candidateWins=${pairwise.candidateWins} baselineWins=${pairwise.baselineWins} ties=${pairwise.ties}`
  );
  console.log(
    `judge (${judgeGating ? "HARD — EVALS_JUDGE_GATING=1" : "advisory"}): averageOverall=${judge.averageOverall.toFixed(2)} n=${judge.n} floor=${JUDGE_OVERALL_GATE_FLOOR}`
  );

  if (decision.advisoryFlags.length > 0) {
    console.log("--- advisory (not gating) ---");
    for (const flag of decision.advisoryFlags) console.log(`  - ${flag}`);
  }
  if (decision.hardFailures.length > 0) {
    console.log("--- HARD FAILURES ---");
    for (const failure of decision.hardFailures) console.log(`  - ${failure}`);
    console.log(`::error::evals CI failed — ${decision.hardFailures.length} hard-gate miss(es), see above`);
  } else {
    console.log("all hard gates green");
  }
}

/**
 * The real entry point. `ANTHROPIC_API_KEY` absent → `::warning` loud-skip, exit 0 — this is
 * belt-and-suspenders with `evals.yml`'s own key check (the workflow already skips this whole
 * step when the secret is empty; this guard exists so `evals:ci` is ALSO safe to run directly,
 * e.g. locally or from a differently-shaped workflow, without silently doing nothing unexplained).
 */
export async function main(): Promise<number> {
  if (shouldSkipLiveEvals(process.env)) {
    console.log(
      "::warning::ANTHROPIC_API_KEY not set — live evals (deterministic gate, classifier floors, judge, pairwise) SKIPPED. GATE 1 requires them; add the secret to unlock."
    );
    return 0;
  }

  const draftingModel = getModel();
  const judgeModel = getModel(JUDGE_MODEL_ID);
  const judgeGating = process.env.EVALS_JUDGE_GATING === "1";

  const deps: CiDeps = {
    runDeterministic: async () => {
      const { results, passRate } = await runDeterministic("live", draftingModel);
      const failures = results
        .filter((r) => !r.pass)
        .map((r) => ({ caseId: r.caseId, rules: r.violations.map((v) => v.rule) }));
      return { passRate, failures };
    },
    runReplyFloors: () => runReplyFloors(),
    runIntentFloors: () => runIntentFloors(),
    runIntentHardFloors: () => runIntentHardFloors(),
    runRankFloors: () => runRankFloors(),
    generateLiveCandidates: () => generateLiveCandidates(draftingModel),
    runPairwise: (candidates) => runPairwise(candidates, judgeModel),
    scoreJudge: (candidates) => scoreJudge(candidates, judgeModel),
  };

  // Fail SAFE on any throw from the run (e.g. a future fixture missing its frozenDraft, a
  // provider/network error mid-run) — a clean `::error::` message and exit 1, never an unhandled
  // rejection that surfaces as an opaque stack trace with an ambiguous exit status.
  let result: OrchestrationResult;
  try {
    result = await orchestrate(deps, judgeGating);
  } catch (err) {
    console.log(`::error::evals:ci failed: ${err instanceof Error ? err.message : String(err)}`);
    return 1;
  }
  printSummary(result, judgeGating);
  return result.decision.exitCode;
}

// Run only when executed directly (`tsx src/ci.ts`) — importing this module (as `ci.test.ts`
// does, for `decide`/`orchestrate`/`shouldSkipLiveEvals`) must never trigger real model calls or
// `process.exit`. Standard ESM "is this the entry module" check.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then((code) => process.exit(code));
}
