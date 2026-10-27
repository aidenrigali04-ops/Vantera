# Machine Learning page — backburner analysis (2026-10-27)

**Status:** parked by the owner on 2026-10-27. Resume after the UX-2 touch-ups and UX-3.
**Source session:** the Oct 21 "landing + favicon + dashboard" session that ended mid-brainstorm on an ML
page. Nothing from it reached the repo; the mockups are throwaway HTML under
`/Users/aidenrigali/vantera-dash/.superpowers/brainstorm/27979-1792639961/content/`.

## 1. What was decided in that session

| Area | Decision |
|---|---|
| Nav | A **Machine Learning** tab in the main nav, after Playbook. |
| Layout | Playground canvas fills the page with ~32px padding; a small **control center** floats top-left; a **status pill** floats top-right (system state · live test · playbook version). |
| Navigation | Drag to pan in every direction, scroll/pinch to zoom, a minimap in a corner. |
| Containers | One per funnel area (Prospecting, First touch, Follow-ups, Conversation…) drawn on the grid. |
| Bots | Round tokens inside a container; a spinning ring marks the busy bot; a short live log under the tokens. |
| Opening a container | A large focused window over the dimmed playground: bot list on the left, tabs **Live activity** and **Output** (drafts written, test results, the decision). |
| Rules kept | One dedicated page. Admins only start/adopt/discard. Safety floors (LinkedIn limits, harm stop, one test at a time) are never user-changeable. **Simulated scores are never shown as real results.** |
| Owner's last call | "Fill containers with real activity — anything not in production but should be, build it." i.e. productionize the bots, not just display them. |

Open at the time: which hive pieces to productionize; where adopt/discard lives; how simulated output is labelled.

## 2. What exists on main today (the ground the page would stand on)

- **ML-0…ML-8 (merged, Oct 21–22):** loop correctness, the per-lead ranking learner (`agent-brains/src/targeting/learn.ts`), the visible readout on Prospects ("What's working", Ranked higher/lower), signal-cited openers, Good fit / Not a fit (`lead_feedback`, 0066), steerable targeting (`agents.config.targeting`), calendar booking detection (0067), lookalikes (`lead_embeddings`, 0068), warm-first sends + intraday intent (0069). Surfaces: Prospects, Playbook, Settings → Scheduling. **No dedicated learning page.**
- **Strategy stamps (0065):** every new lead is stamped, but always `source='default'`, `arm=null`, empty genome — the stamps record what happened, not cause and effect. No UI.
- **`lab_decisions` (0070) and the `sim` schema (0071):** on main and in prod as of PR #80. **Nothing on main writes `lab_decisions`**; the writer lives only in the parked WIP.
- **The old optimizer is gone as an engine.** PR #69 (merged 2026-10-22) removed the daily `optimize` task, A/A canary, experiment creation, challenger arm assignment and Adopt/Discard. `optimization_experiments` / `optimization_playbook` remain as dormant tables that nothing reads or writes. The "live test since Oct 15" the ML page was designed to show is frozen data. `agent-brains/src/optimize/*` (diagnose, recommend, bandit, cohort) stays as pure logic.
- **Research hive** (`agent-brains/src/research/*`, `hive/*`): on main, CLI-only, stores nothing.

## 3. Where the unmerged pieces are

| Piece | Location | State |
|---|---|---|
| Subject model (ML-9 "adaptive prospecting": optimizer agent kind, enabled/guardrails in `agents.config`, calibrate-accounts cron, stub optimizer task, `/learning` page + nav tab) | `origin/phase-adaptive-A1-instrumentation` → `A2-calibration` (PR #63) → `B1-subject` | Unmerged. Its migration is numbered `0066` and collides with main; renumber to 0073+. Its stamp code duplicates main — drop that part. |
| lab_decisions writer (`jobs/src/lab/decision.ts` + the insert in `pg-store.ts`), engine ports (`jobs/src/engine/*`), seeded sim world + live arena (`jobs/src/sim/*`), `apps/sim` viewer, `dashboard/lab` shell with KPI tiles + canvas, a second `/learning` built on **hard-coded** `SUBJECTS`/`SEED_CONTAINERS` mocks, a **Results** nav tab | Local branch **`wip/adaptive-sim-hive-2026-10-27`** (snapshot of the shared tree, 75 commits behind main, not rebased) | Preserved, parked. Collides with UX-2's chrome (`layout.tsx`, nav, prospects, today, playbook) and with ML-7/8 in `pg-store.ts`. Its `/learning` and `learning.md` conflict with B1's. |
| Earlier hive container/export code | tag `archive/feat-hive-simulator` (local) | Superseded by the WIP. |

Both the B1 `/learning` (DB-backed subjects, no canvas) and the WIP `/learning` (canvas, mock subjects) are partial takes on the same page. Neither matches the Oct 21 design.

## 4. Gap analysis for the page as designed

**Can be shown today from main:** stamp counts per strategy (one "default" bucket per account), Good fit / Not a fit counts, the learner readout and feature lifts from `agent_runs`, lookalike coverage (server-side count), calendar-attributed meetings, `lab_decisions` rows (empty until the writer ships).

**Missing before the page is honest:**
1. A per-account **subject / learning on-off record** (B1's optimizer agent, renumbered).
2. The **`lab_decisions` writer** in the scheduling transaction (WIP `lab/decision.ts`).
3. **Per-strategy / per-experiment rollups** (meetings per 100 sourced by strategy and arm, lift vs holdout) — no view or RPC exists; B1's calibration only fits base rates.
4. **Real non-default strategies and randomized arms** — today every stamp is `default`. Without this the containers have nothing to compare.
5. A persisted **experiment/container model** and **bot run log** — the hive proposers (mutator, crossover, contrarian, specialist, scientist, strategist, deliberator + Governor) store nothing; "Live activity" needs a table and a writer.
6. A clear **simulated vs real** boundary in the data model, so the "never show simulated as real" rule is enforced by schema, not by copy.

## 5. Recommended resume plan (when the owner un-parks it)

1. **ML-9a — subject + decision log (backend only).** Merge B1's subject model renumbered onto main; port the `lab_decisions` writer; keep learning off by default. Help article `learning.md` (B1's text). No page yet.
2. **ML-9b — strategies that differ.** Real strategy genomes + randomized arm assignment at stamp time, behind the subject switch; one rollup view (strategy × stage outcomes). This is what gives containers something to show.
3. **ML-9c — bot runs persisted.** A `lab_runs`/`lab_events` table (RLS, retention stated) that the hive proposers and Governor write when run in production mode; `sim` output stays in the `sim` schema so it can never be read as real.
4. **ML-9d — the page.** Build the Oct 21 design against 9a–9c: control center (subject on/off, guardrails read-only below the floors, adopt/discard for admins), playground with one container per funnel stage reading real rollups, focused window with Live activity (lab_events) and Output (lab_decisions + drafts). Reuse the rule-07 app-surface tokens; "Machine Learning" tab after Playbook.
5. Only then retire the WIP branch and the archive tags.

Start from a fresh worktree off main; do **not** rebase `wip/adaptive-sim-hive-2026-10-27` wholesale — cherry-pick `lab/decision.ts`, `engine/*`, `sim/*` by file.

## 6. Branch hygiene done on 2026-10-27

- Deleted 50 remote branches whose commits are all in main (36 by ancestry, 14 by patch).
- Tagged locally (`archive/*`) and slated for deletion the branches that would break or degrade main if merged: `fix/optimize-stale-canary` (patches code #69 removed), `feat/dashboard-landing-system` and `feat/landing-frame-intent` (older UI, 91–98% already in main), `feat/hive-simulator` (superseded), `phase-owned-email-infra` (email retired), `lifecycle-linkedin-outreach` (old auth panel), `diagnostics-signup-onboarding-funnel` (onboarding is frozen), `fix/trial-cap-silent-zero` (removes safety limits for the admin workspace). The remote deletes and the PR closes (#67, #18) need the owner: `scratchpad/remove-degrading-branches.sh`.
- Kept: `phase-adaptive-*` (PR #63), `ci/deploy-promotion-guard` (PR #79, merge it), `phase-ux2-reasons-queue` (PR #81, merge it), the WIP snapshot.
