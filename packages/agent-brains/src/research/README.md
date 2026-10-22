# The Hive — research layer

Autonomous strategy search for Vantera's funnel. No human in the loop; a Governor judges.

- `brains.ts` — proposers (mutator, crossover, contrarian, specialist, scientist, strategist).
  They see only the champion, the verdict library and their own record. Never a world, seed or
  evaluator. The strategist assembles this account's best supported combination from that record.
- `deliberator.ts` — optional language strategist. Registered only when a model is passed in
  (`hive -- --llm`, or `hive:compare`). Same inputs, same gates. It does not report a result.

Each hive is one account. The champion is derived from that account's measured outcomes. ICP,
brand, services, and value stay on the account. This loop does not publish a global strategy.

This package is the baseline. The live product does not call it yet. A later stage wires it
into prospecting. Until then, a run here changes no account, no draft, and no send.
- `proposal.ts` — pre-registered proposals. Any well-formed idea is accepted. A missing forecast, a falsifier that cannot fail, or a malformed genome is refused and never coerced. The catalog in `../hive/arenas.ts` is what the hidden scorer has a planted response for, not a menu the bots must stay inside.
- `evaluator.ts` — the Governor's hidden scorer: harm-adjusted meetings per 100 sourced on hidden worlds.
- `governor.ts` — screen (fresh worlds) → replicate (second fresh set) → seal (sealed holdout) →
  verdict. Binding falsifiers, harm guardrail, worst-family robustness, overfitting audit, elite
  archive, plateau reseeding, automatic promotion.
- `governor.test.ts` — the anti-cheating guarantees as tests.

Continuous mode (default): the hive never stops on patience alone. It converges only when it is
EXHAUSTED — every untested single-gene move from the champion has been raced and a final sweep
found nothing. Verdicts use PAIRED evaluation (champion vs challenger on the same worlds), which
is what lets real but small effects clear the sealed test without loosening any guardrail.

Run it: `pnpm --filter @vantera/agent-brains hive -- --seed 11 --out ./hive-results`

With the deliberator: `pnpm --filter @vantera/agent-brains hive -- --seed 11 --llm`

Compare arms: `pnpm --filter @vantera/agent-brains hive:compare`

World base rates in `../hive/sim/world.ts` are assumptions until calibrated to real outcomes.
