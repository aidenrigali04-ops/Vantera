# Evals — CI wiring, gating contract, and the model-upgrade protocol

Phase 2B, Task 8. This is the operator-facing doc for `packages/evals` and `.github/workflows/evals.yml` —
what runs when, what can fail a build, and what an `ANTHROPIC_MODEL` change requires before it ships.
See `packages/evals/README.md` for the package's own architecture note, and rule 13
(`.claude/rules/13-sdr-agent-framework.md`) + rule 09 (`.claude/rules/09-help-copilot.md`, knowledge-sync)
for the conventions this suite inherits.

## The three layers

| Layer | Modules | Posture | Why |
|---|---|---|---|
| **Deterministic copy gate** | `run-deterministic.ts` (`runDeterministic("frozen" \| "live")`) | **HARD** | Relints every generated draft with the EXACT production graders (`@vantera/agent-brains`'s humanizer/grounding checks) the drafting brains already run internally. `"frozen"` mode (the unit-test path, `graders/deterministic.test.ts`) asserts exact `passRate === 1` over the 36 hand-verified corpus baselines — a frozen-baseline lint failure is always a real grader/fixture regression, never variance, so it stays 100%-hard. `"live"` mode (`ci.ts`'s CI gate) asserts `passRate >= DETERMINISTIC_LIVE_FLOOR` (**0.9**, not exact 100%): it regenerates a fresh draft per case via the real (stochastic) drafting brains, and production already routes a still-lint-dirty draft (after `draftLinkedIn`/`draftConversationMessage`'s internal `generateHumanized` regenerate) to human review rather than blocking or auto-sending it — so a small, review-routed fraction among 36 freshly-generated live samples is expected sampling variance, not a defect. Only a passRate that drops *below* the floor — a systematic lint-violation rate — signals a real prompt/copy regression worth failing the build over. See `DETERMINISTIC_LIVE_FLOOR`'s doc comment in `ci.ts` for the full rationale (why 0.9, not 1). |
| **Classifier accuracy floors** | `run-classifier.ts` (`runReplyFloors`, `runIntentFloors`, `runIntentHardFloors`, `runRankFloors`) | **HARD** | Bounds the classifiers and ranker that gate the funnel before anything reaches a human or costs enrichment spend: reply-interested recall (≥ 0.90), intent recall (≥ 0.85), intent precision (≥ 0.80), hard-intent precision (≥ 0.85) and recall (≥ 0.80 when the set has ≥5 positives), rank qualify precision (≥ 0.80) / recall (≥ 0.85), rank offering-direction (≥ 0.90 on the labeled buyer/seller subset). Any `FloorReport.pass === false` fails the build. The hard-intent set is a separate labeled file from the 24 clear-cut intent rows — likes with empty evidence, congratulations, and “anyone recommend X” belong there, not in the original set. |
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
(36 copy cases + the labeled classifier sets, plus one extra `rankLeads` pass and one extra hard-intent `classifyIntent` batch) this still lands around $2-5 per run, but budget for
the doubling — it is the dominant cost driver at nightly cadence (factor it into the ~$50-100/mo
eval budget; the classifier floors, rank floors, and the judge scoring calls are on top of the generation cost).

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
`decide()`. This split means the orchestration logic — "does a passRate below `DETERMINISTIC_LIVE_FLOOR` fail the build," "does an
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

Judge calibration turns the advisory judge into a gate. It needs ~100 drafts hand-rated by a human
and compared against the judge's own scores via Cohen's kappa. Two ways to assemble that label set
— the packet tool (Phase 2C, Task 1) is the recommended path since it removes the "how do I even
get 100 drafts to label" friction that blocked this step; the original manual `human-labels.json`
path (Phase 2B, Task 6) still works and is still guarded by its own fixture-integrity test.

### The recommended path: `calibration-prep` + `evals:calibration-score`

`packages/evals/src/calibration-prep.ts` is the unblocker tool:

1. **Run the `calibration-prep` GitHub Actions workflow** (`.github/workflows/evals.yml`,
   `workflow_dispatch` only — Actions tab → Evals → Run workflow). API-key-gated with the same
   loud-skip contract as the main `evals` job: no `ANTHROPIC_API_KEY` secret → a visible
   `::warning::` and the job exits clean without spending anything.
2. It runs `pnpm --filter @vantera/evals evals:calibration-prep`
   (`buildCalibrationPacket()`), which drafts ~100 real copy samples across BOTH copy corpora
   (interleaved, cycling back once the 36-case combined corpus is exhausted — see the sampling
   note in `calibration-prep.ts`'s module doc), scores every draft with the judge, and writes
   `packages/evals/fixtures/judge-calibration/packet.json`. **Every entry's `humanOverall` is
   hardcoded to `null`** — the machine never fills the human column; `calibration-prep.test.ts`
   asserts this on every entry, every run. The judge's own `judgeOverall` (1-5) is already filled
   in, so the owner is rating blind to nothing but also spending no extra judge calls at score time.
3. **Download the `calibration-packet` artifact** from the completed workflow run and open
   `packet.json`. For each entry, replace `"humanOverall": null` with an integer 1-5 (same rubric
   the judge uses, `JUDGE_PROMPT` in `judge/judge.ts` — or a quick good/bad call mapped to 5/1).
   You do not need to label every entry to score — `scoreCalibration` only uses entries you've
   filled in, and refuses to compute anything below `MIN_LABELED_FOR_SCORE` (20) labeled entries.
4. Run `pnpm --filter @vantera/evals evals:calibration-score /path/to/filled-packet.json` — this
   pairs each labeled entry's (already-computed) `judgeOverall` against your `humanOverall`, bins
   both to good/bad (`overall >= 4`, the same `binOverall` convention `runCalibration` uses), and
   prints Cohen's kappa + whether it clears `KAPPA_TRUST_THRESHOLD` (0.7).
5. **On `trusted: true`** (κ ≥ 0.7): set the `EVALS_JUDGE_GATING=1` repo variable, AND replace the
   provisional `JUDGE_OVERALL_GATE_FLOOR = 3.5` in `ci.ts` with a calibration-derived value (e.g.
   the median `humanOverall` from the filled packet) — the provisional 3.5 was a placeholder with
   no study behind it (see its doc comment in `ci.ts`); this is the moment it gets replaced with a
   real number.
6. **Anonymize before committing anything derived from this packet.** The filled `packet.json`
   itself is a generated, gitignored artifact (never committed as-is), but if you fold any of its
   labeled entries into `human-labels.json` for a permanent record, they're subject to the SAME
   fictional-names rule as every other fixture (rules 03-05) — `human-labels.test.ts` scans that
   file for vendor names / non-`.example` URLs and fails CI on a leak.

### The original manual path: `runCalibration` + `human-labels.json`

Still valid if you'd rather assemble labels by hand outside the packet workflow (e.g. rating drafts
gathered from some other source):

1. Pull ~100 real drafts — a mix of frozen corpus baselines and live-generated ones covers more
   ground than either source alone (see `packages/evals/fixtures/judge-calibration/human-labels.README.md`).
2. Rate each 1-5 on the same rubric the judge uses (`JUDGE_PROMPT` in `judge/judge.ts`), and append
   one `HumanLabel` object per rated draft to `fixtures/judge-calibration/human-labels.json` (ships
   as `[]`).
3. Run `runCalibration(humanLabels)` (e.g. from a scratch script or a REPL against the package) —
   it calls `judgeCopy` for every label, bins both scores to good/bad (`overall >= 4`), and computes
   Cohen's kappa between the judge's calls and the human's.
4. `kappa >= 0.7` (`KAPPA_TRUST_THRESHOLD`) → `trusted: true`. Only then set `EVALS_JUDGE_GATING=1`
   and update `JUDGE_OVERALL_GATE_FLOOR` (same step 5 above). Below 0.7, the judge disagrees with a
   human often enough that it isn't safe to gate on yet — iterate on `JUDGE_PROMPT` or gather more
   labels, don't flip the flag.

This calibration step (either path) is one of the four **owner arm-steps** blocking GATE 1 (see the
Task 8 brief / the PR body): add the `ANTHROPIC_API_KEY` secret, sign off the anonymized fixtures,
run this calibration and flip the flag, and set the ~$50-100/mo eval budget for nightly cadence.

## Copy Quality Loop (Phase 2C)

Phase 2C built one owner-driven loop on top of the eval harness above: **calibrate → best-of-N →
prompt-AB → decide.** This section is the operator map of that loop — what each stage does, the
trust boundary that gates all of it, and how to choose the next lever once it's running.

### The sequence and the trust boundary

1. **Calibrate** (Task 1, documented above) — the owner labels a packet of real drafts and runs
   `evals:calibration-score` to get Cohen's κ between the judge and a human rater.
2. **Best-of-N** (Task 3) — `bestOfN()` in `@vantera/agent-brains` drafts N candidates per lead
   and has the judge (`copy/judge`, `claude-opus-4-8`) rank them; the top-scored candidate is the
   one that flows onward. Wired today at exactly one call site: the LinkedIn first-touch path in
   `packages/jobs/src/pipeline/copy-draft.ts`.
3. **Prompt-AB** (Task 4) — `evals:prompt-ab` / `promptAB(candidateSystem, brain, model?)` runs a
   candidate system-prompt rewrite through the same position-swapped pairwise machinery as CI,
   producing win-rate proposals against the frozen baseline. See
   `docs/prompt-experiments/2026-07-18-copy-v1.md` for the four variants written up so far
   (sharper hook, harder them-focus, tighter anti-slop, a respond-brain them-focus mirror) — all
   proposals, none merged.
4. **Decide** — pick the next lever to invest in. See "The decide framework" below.

**The trust boundary is κ ≥ 0.7, full stop.** Nothing judge-driven gates a build or auto-ships
copy until calibration clears that bar (`EVALS_JUDGE_GATING=1` is the flip — see above). That
boundary also governs how much to trust the OTHER two levers built on top of the same judge:

- **Best-of-N ranking is only *trusted* post-calibration.** Pre-calibration, an uncalibrated judge
  picking the "best" of N candidates is a **likely-but-unproven lift** — it's plausible that a
  stronger, different-family model (Opus) ranking candidates on the same rubric humans intuitively
  use tends to pick better copy, but nothing has measured that the judge's ranking correlates with
  what a human — or a real prospect — would actually prefer. Treat any quality gain from turning
  best-of-N on before calibration as a hypothesis, not a result.
- **Prompt-AB win-rates are advisory for the same reason.** A variant "winning" pairwise against
  the baseline means "an unvalidated judge preferred it" until κ ≥ 0.7 — see Task 4's findings doc
  for the full reasoning. A prompt swap into `LINKEDIN_SYSTEM`/`RESPOND_SYSTEM` is always an
  owner-reviewed, deliberate change, never an automatic promotion off a win-rate number.

### Enabling best-of-N

Best-of-N is a **global** `app_settings` row, `key = 'best_of_n'`, read once per `copy-draft`
trigger run (`pg-store.ts`'s `getBestOfN()`) — the same shape as `outreach_kill_switch`, not a
per-account setting, and there is no UI toggle for it (see the knowledge-sync note below). Default
is `1` (unset, non-numeric, or ≤ 0 all resolve to `1`) — at `n=1` the pipeline drafts exactly once
and the judge never runs, so **the feature is fully OFF by default and byte-identical to
pre-Phase-2C behavior** until someone raises the setting. To enable, set the row to a value up to
5 (e.g. `5`) — `MAX_BEST_OF_N` in `copy-draft.ts` code-enforces that ceiling regardless of what the
setting says, so a config typo can't blow up spend.

**Recommend enabling only AFTER calibration clears κ ≥ 0.7** — see the trust-boundary note above.

**Cost — read this before enabling.** Best-of-N is n× draft generations **and** n× Opus judge
calls, **per first-touch LinkedIn lead**, not per run. At `best_of_n=5`: 5 draft calls + 5 judge
calls per qualified lead that reaches the copy-draft step. `copy-draft.ts`'s `DRAFT_CONCURRENCY`
(4 leads in flight at once) × `MAX_BEST_OF_N` (5) means the pipeline can have **up to 20
concurrent Opus judge calls in flight** at once when best-of-N is maxed out — a real
rate-limit/cost consideration on top of the raw per-lead multiplier, not just a linear cost
increase. Size the setting (and watch for 429s) accordingly; there is no built-in backoff beyond
`mapWithConcurrency`'s concurrency cap.

### The anti-Goodhart invariant

The judge **ranks candidates that would all be drafted anyway** — it never gates, never blocks a
send, and never bypasses the humanizer. The winner of a best-of-N round still flows through the
UNCHANGED humanizer/`fixLinkedInFn` gate exactly like a single draft always has: a judge-preferred
candidate that's lint-dirty still gets one fix pass or routes to review, same as before this
feature existed. **The real gates are the humanizer (deterministic, hard) and live outcomes**
(acceptance → reply → booking), never the judge's opinion of itself. Never tune copy, prompts, or
the judge to raise the judge's own score in isolation — a rising judge average with no
corresponding rise in reply/booking rate is a signal something is being optimized for the wrong
target, not a win.

### Two responder paths remain unwired (named fast-follows)

Best-of-N is wired at exactly one call site. Two other production draft call sites use the same
`buildSendRecipe`/humanizer shape but do **not** run through `bestOfN()` yet:

- **`packages/jobs/src/pipeline/sequence-touch.ts`** (`SequenceTouchDeps.draftFollowupFn`, the
  mid-conversation proactive-touch path) — materially more complex than the first-touch path
  (thread-aware grounding, `MAX_AGENT_TURNS` caps, freshness/refresh branching) and needs its own
  grounding-string helper before best-of-N can wire in safely.
- **`packages/jobs/src/pipeline/inbound.ts`** (`maybeRespond`/`InboundDeps.respondFn` — the ACTIVE
  responder that replies to inbound LinkedIn messages) — same `MAX_AGENT_TURNS` gate and
  thread-grounding shape as `sequence-touch.ts`.

Both are scoped fast-follow work, not silently dropped — flagged here so best-of-N's coverage
(first touch only) isn't mistaken for "all drafting paths."

### The decide framework (post-calibration)

Once calibration is trusted, best-of-N is live, and at least one prompt-AB proposal has been
measured, the next question is which lever to invest in next. Three candidates, framed honestly
against the conversion/activation audit:

1. **More knobs / a bigger bandit strategy space** — extend the self-optimizing loop's strategy
   directives (more levers for the champion/challenger bandit to explore) or extend best-of-N
   coverage to the two unwired responder paths above. Incremental, compounds with what's already
   built.
2. **Richer grounding** — better `ai_insights`/proof points feeding the drafting prompt. This is
   the actual **ceiling** on specificity and them-focus: no prompt rewrite or best-of-N ranking can
   make an opener more specific than the grounding data it's given. If the grounding is thin,
   copy-quality work above this line is polishing a ceiling that's already been hit.
3. **The conversation-to-booking funnel** — the audit's flagged **realized-value gap**: 10
   interested replies → 0 meetings booked. This is very likely the **highest-revenue lever** of the
   three. Copy greatness on the opener does not book a meeting if the booking handoff itself is
   broken downstream (the stalled review-queue approval from the first external activation,
   0-of-3 owner booking URLs set). A perfect judge score on an opener is worthless if the person who
   replies "interested" never gets a meeting on the calendar.

**Recommendation: measure each lever's lift via the eval harness (judge score, pairwise win-rate)
AND the live funnel (reply rate, meeting-booked rate) before picking — decide by realized-value
impact, not by judge score alone.** A lever that raises the judge average but does nothing for
replies-to-meetings is not the next investment; the funnel gap in particular should be measured
directly against booking outcomes, since no eval-harness judge score can observe it at all (it's
downstream of copy entirely). This mirrors the anti-Goodhart invariant above: the judge accelerates
*within* a lever, it does not choose *which* lever to fund.

### Knowledge-sync judgment (rule 09)

Best-of-N is a subtle, behind-the-scenes quality mechanism inside the existing copy-draft
pipeline — it changes nothing a customer sees or configures (no new page, no new setting they can
toggle, no new concept in the product's mental model). The `best_of_n` app-setting is a global,
operator-only row with no `accountId` and no UI, set directly the same way
`outreach_kill_switch` is. Per rule 09's own framing ("any PR that adds or changes **user-facing**
behavior"), this does not qualify: **no help-content article is being added for this task.** If a
future task adds an account-level settings toggle for best-of-N (making it user-visible and
user-controlled), that PR must ship the matching help-content article at that time — this doc
states the judgment explicitly so that obligation isn't lost.

## The model-upgrade shadow protocol

Any change to the model an `ANTHROPIC_MODEL`-style config resolves to (drafting model, judge model,
or both) is a **change to production behavior**, not a routine dependency bump — it must go through
this protocol before it ships to real prospects:

1. **Full eval suite green first.** Both hard layers (deterministic `passRate >= DETERMINISTIC_LIVE_FLOOR`,
   every classifier floor) must pass against the NEW model before anything else happens. A model swap
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
