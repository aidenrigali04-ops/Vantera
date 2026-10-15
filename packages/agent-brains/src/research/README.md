# The Hive — research layer

Autonomous strategy search for Vantera's funnel. No human in the loop; a Governor judges.

- `brains.ts` — five proposers (mutator, crossover, contrarian, specialist, scientist). They see
  only the champion, the verdict library and their own record. Never a world, seed or evaluator.
- `proposal.ts` — pre-registered proposals validated against the closed gene sets in `../hive/arenas.ts`.
- `evaluator.ts` — the Governor's hidden scorer: harm-adjusted meetings per 100 sourced on hidden worlds.
- `governor.ts` — screen (fresh worlds) → replicate (second fresh set) → seal (sealed holdout) →
  verdict. Binding falsifiers, harm guardrail, worst-family robustness, overfitting audit, elite
  archive, plateau reseeding, automatic promotion.
- `governor.test.ts` — the anti-cheating guarantees as tests.

Viewer bundle: `esbuild src/research/browser-entry.ts --bundle --format=iife --global-name=Hive`.

World base rates in `../hive/sim/world.ts` are assumptions until calibrated to real outcomes.
