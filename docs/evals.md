# Evals — CI wiring, gating contract, and the model-upgrade protocol

Phase 2B, Task 8. This is the operator-facing doc for `packages/evals` and `.github/workflows/evals.yml` —
what runs when, what can fail a build, and what an `ANTHROPIC_MODEL` change requires before it ships.
See `packages/evals/README.md` for the package's own architecture note, and rule 13
(`.claude/rules/13-sdr-agent-framework.md`) + rule 09 (`.claude/rules/09-help-copilot.md`, knowledge-sync)
for the conventions this suite inherits.

## The three layers

| Layer | Modules | Posture | Why |
|---|---|---|---|
| **Deterministic copy gate** | `run-deterministic.ts` (`runDeterministic("frozen" \| "live")`) | **HARD** | Relints every generated draft with the EXACT production graders (`@vantera/agent-brains`'s humanizer/grounding checks) the drafting brains already run internally. `passRate === 1` — one dirty draft anywhere in the corpus fails the whole suite. No partial credit for copy that reaches a real prospect. |
| **Classifier accuracy floors** | `run-classifier.ts` (`runReplyFloors`, `runIntentFloors`) | **HARD** | Bounds the two classifiers that gate the funnel before anything reaches a human or costs enrichment spend: reply-interested recall (≥ 0.90), intent recall (≥ 0.85), intent precision (≥ 0.80). Any `FloorReport.pass === false` fails the build. |
| **LLM judge + pairwise win-rate** | `judge/judge.ts` (`judgeCopy`), `judge/pairwise.ts` (`runPairwise`) | **ADVISORY** (until calibrated — see below) | A stronger, different-family model (Opus) rates specificity/them-focus/posture/naturalness/overall, and separately does position-swapped A/B against each case's frozen baseline. Reported every run for visibility and trend-tracking, but nothing gates on it until the judge itself is proven trustworthy. |

The pure-logic unit suite (`pnpm --filter @vantera/evals test` — mock models, no network) is
always green in normal CI regardless of secrets; it's the fast, free layer and runs on every
trigger, including PRs from forks with no access to the `ANTHROPIC_API_KEY` secret.

## The API-key-gated contract

`packages/evals/src/ci.ts` (`evals:ci` script, `tsx src/ci.ts`) is what `evals.yml`'s "Live evals"
step runs. Two independent, redundant checks — belt-and-suspenders on purpose, so the loud-skip
still fires even if `ci.ts` is ever invoked from a differently-shaped workflow or locally:

1. **`evals.yml` itself** checks `secrets.ANTHROPIC_API_KEY` before even invoking `evals:ci`: empty
   → prints `::warning::…` (a visible annotation on the run, not a buried log line) and `exit 0`.
2. **`ci.ts`'s `main()`** (`shouldSkipLiveEvals`) repeats the same check and the same `::warning`
   message before doing anything else.

**The contract: absent key is always a loud skip, never a silent green.** A run where the live
evals never executed must be visually distinguishable (the `::warning` annotation) from a run
where they executed and passed — this is what keeps GATE 1 from being accidentally declared "green"
by a PR that simply never had the secret available.

Runner choice: **`tsx`** (already a devDependency of `@vantera/help-content`'s `build-index`
script, pinned here to the same `^4.0.0`) — the simplest path to running one standalone TypeScript
entry file without adding a build step, consistent with the one other place in the monorepo that
already does this.

### Cost — live drafts are generated ~2x per `evals:ci` run

A live run generates every corpus case **twice**, not once: the deterministic gate
(`runDeterministic("live")`) generates a fresh draft per case internally (it only returns pass/fail
`GradeResult`s, never the draft text), and the judge + pairwise layers need the actual draft text,
so `ci.ts`'s `generateLiveCandidates` does a **second full-corpus generation pass** to produce
candidates for them. Net: each case is drafted ~2x per invocation. At the current fixture volume
(~34 copy cases + the labeled classifier sets) this still lands around $2-5 per run, but budget for
the doubling — it is the dominant cost driver at nightly cadence (factor it into the ~$50-100/mo
eval budget; the classifier floors and the judge scoring calls are on top of the generation cost).

**Named follow-up (not built): the single-shared-pass optimization.** Have `runDeterministic`
optionally return the draft text (or add a `generateAndGrade` variant) so the judge + pairwise
layers reuse the deterministic gate's drafts instead of regenerating — collapsing the ~2x back to
~1x. Deferred here to keep this task's edit surface to the assigned files; `run-deterministic.ts` is
a committed, frozen file from Task 4 and changing its public return shape is out of scope for the CI
wiring task.

## `ci.ts`'s decision logic

`decide()` is a **pure function** — no I/O, no `process.exit` — that takes already-computed results
(deterministic pass rate, the floor reports, the pairwise report, a judge summary, and the
`judgeGating` boolean) and returns an exit code plus human-readable reasons. `orchestrate()` sequences
the actual run-fns (real in `main()`, injected fakes in `ci.test.ts`) and folds their output through
`decide()`. This split means the orchestration logic — "does a passRate < 1 fail the build," "does an
advisory judge/pairwise miss ever flip the exit code before `EVALS_JUDGE_GATING=1`" — is covered by
`packages/evals/src/ci.test.ts` with zero network calls, running in the same fast suite as everything
else in this package.

`main()` is the only piece that touches `process.env`/`process.exit`/real model calls, and it only
runs when `ci.ts` is executed directly (`tsx src/ci.ts`) — importing the module (as the test file
does) never triggers a live run.

## The `EVALS_JUDGE_GATING` flip

Set once, by hand, after judge calibration (below): `EVALS_JUDGE_GATING=1` in the environment
`evals:ci` runs in (a GitHub Actions repo/environment variable, not a secret — it's not sensitive).

- **Before the flip (default, `EVALS_JUDGE_GATING` unset):** a pairwise non-inferiority miss or a
  judge average-overall-score miss is printed under "advisory (not gating)" in the summary and
  never changes the exit code.
- **After the flip:** the exact same two checks additionally get pushed into `hardFailures`, so a
  miss on either now fails the build like the deterministic gate or a classifier floor does.

Nothing else changes when the flag flips — the hard gates (deterministic, classifier floors) are
unconditional in both states.

## Judge calibration procedure (owner-run, not part of routine CI)

`runCalibration` (`packages/evals/src/judge/kappa.ts`) is a **manual, local** step — `ci.ts` never
calls it as part of a normal run, because it needs a human-labeled fixture the owner fills once:

1. Pull ~100 real drafts — a mix of frozen corpus baselines and live-generated ones covers more
   ground than either source alone (see `packages/evals/fixtures/judge-calibration/human-labels.README.md`).
2. Rate each 1-5 on the same rubric the judge uses (`JUDGE_PROMPT` in `judge/judge.ts`), and append
   one `HumanLabel` object per rated draft to `fixtures/judge-calibration/human-labels.json` (ships
   as `[]`).
3. Run `runCalibration(humanLabels)` (e.g. from a scratch script or a REPL against the package) —
   it calls `judgeCopy` for every label, bins both scores to good/bad (`overall >= 4`), and computes
   Cohen's kappa between the judge's calls and the human's.
4. `kappa >= 0.7` (`KAPPA_TRUST_THRESHOLD`) → `trusted: true`. Only then set `EVALS_JUDGE_GATING=1`.
   Below 0.7, the judge disagrees with a human often enough that it isn't safe to gate on yet —
   iterate on `JUDGE_PROMPT` or gather more labels, don't flip the flag.

This is one of the four **owner arm-steps** blocking GATE 1 (see the Task 8 brief / the PR body):
add the `ANTHROPIC_API_KEY` secret, sign off the anonymized fixtures, run this calibration and flip
the flag, and set the ~$50-100/mo eval budget for nightly cadence.

## The model-upgrade shadow protocol

Any change to the model an `ANTHROPIC_MODEL`-style config resolves to (drafting model, judge model,
or both) is a **change to production behavior**, not a routine dependency bump — it must go through
this protocol before it ships to real prospects:

1. **Full eval suite green first.** Both hard layers (deterministic `passRate === 1`, every
   classifier floor) must pass against the NEW model before anything else happens. A model swap
   that fails either gate does not proceed — fix the prompt/config for the new model, or don't swap.
2. **48-hour shadow-generation window.** After the eval suite is green, the new model runs in
   **shadow** — generating drafts alongside (never instead of) the current production model, on
   real (or realistic) traffic, for at least 48 hours, so the drafts a human would actually judge
   accumulate before any user-facing commitment. Nothing from the shadow window auto-adopts; a
   human reviews a sample before the flip.
3. **Flip.** Only after (1) and (2) both hold does the new model become the one real traffic uses.

**The shadow-generation automation itself is a named follow-up, NOT built in this task or in Phase
2B.** Today the 48-hour window is a manual discipline (owner runs the new model in a side channel
and compares by hand); automating step 2 — a scheduled job that runs both models on a trickle of
live-shaped inputs and diffs judge scores over the window — is deferred work, alongside the weekly
drift monitor (`eval_runs` table + a Trigger task piggybacked on the existing agent-scheduler tick,
never a new schedule — Trigger's cron quota is already 10/10, see the prod-ops gotchas note).

## How to add a fixture

Golden-set corpora (`fixtures/copy-linkedin/`, `fixtures/copy-respond/`) and labeled classifier
sets (`fixtures/classify-reply/`, `fixtures/classify-intent/`) are all directory-of-JSON-files,
read via `fs.readdirSync` in filename order (never a static `import` — these run under vitest's
node environment) — see `packages/evals/src/corpus.ts` and `run-classifier.ts`'s `readLabeledArray`.
Adding a fixture is always a **one-file add**, never a loader change:

- **Copy corpus case** (`fixtures/copy-linkedin/<kebab-id>.json` or `fixtures/copy-respond/<kebab-id>.json`):
  a `CopyLinkedinCase`/`CopyRespondCase` — a valid brain `input` (the exact shape `draftLinkedIn`/
  `draftConversationMessage` accept), the citable-facts `grounding` string the humanizer's
  ungrounded-claim lint checks against, and optionally a hand-verified `frozenDraft` (required for
  `"frozen"` mode and for pairwise's baseline comparison — every new fixture should ship one).
- **Classifier label** (`fixtures/classify-reply/labeled.json` or `fixtures/classify-intent/labeled.json`):
  append a `ReplyLabel`/`IntentLabel` entry to the existing array — a clear-cut, hand-reviewed
  example, not a statistically-representative sample.
- **Judge calibration label** (`fixtures/judge-calibration/human-labels.json`): see the calibration
  procedure above.

**The fictional-names / `.example` rule applies to every fixture, no exceptions:** zero real vendor
names, zero real prospect/company names (use invented ones — the existing fixtures are named by
industry+role, e.g. `li-biotech-founder-procurement.json`, never a real company), and any URL in a
fixture must be `.example` or on the explicit compliance whitelist. This is enforced by the
fixture-integrity test in the corpus/classifier test files — a new fixture that trips it fails
`pnpm --filter @vantera/evals test`, the same hard, fast layer that always runs.

## GATE 1 (unlock criteria, for reference)

GATE 1 = **both halves green**: (a) this evals CI hard-gating (deterministic copy gate + classifier
floors) on prompt/copy PRs, and (b) WS-1's calibration gates (shipped in Phase 2A: null
false-adoption ≤ 5%). Gated on those PLUS the owner's judge-calibration (κ ≥ 0.7, `EVALS_JUDGE_GATING=1`
flipped), a tiny follow-up flips autonomous adoption back on via the unified `ready_to_adopt` +
24h-grace config (WS-3.2) — that flip is a deliberately separate, later change, not part of this doc
or this task.
