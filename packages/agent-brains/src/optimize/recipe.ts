import type { CopyStrategy } from "../copy/shared";

/**
 * Message-level recipe attribution (Vera Stage 1, spec 2026-07-14; v2 promptHash/modelId,
 * enterprise-grade-brain Phase 2A WS-3.4). Every agent-drafted message is stamped at draft time
 * with the recipe that produced it, so outcomes can be joined to the exact approach — the data
 * spine the bandit loop will stand on. Pure.
 *
 * v2 adds `promptHash` (the registry hash of the exact system-prompt revision that drafted the
 * message, from `registerPrompt` in `@vantera/ai` — see `LINKEDIN_SYSTEM`/`RESPOND_SYSTEM`) and
 * `modelId` (the resolved model id at draft time, from `getModelId()` in `@vantera/ai`). Both are
 * `null` on a v1 stamp — a stamp is written once, at draft time, from what was actually true
 * then; there is no honest way to reconstruct a prompt hash or model id for a message drafted
 * before this field existed, so v1 rows are NEVER backfilled. Readers that only need `strategy`/
 * `brain` (e.g. `getStampedOutcomes`, which reads `recipe->'strategy'` and `recipe->>'brain'` via
 * jsonb path ops) stay v1-compatible automatically — those keys are unchanged and v1 rows keep
 * reading fine. Only code that dereferences `promptHash`/`modelId` needs to treat a v1 row's
 * nulls as "unknown", not "no prompt/model was used".
 */

/** Which drafting brain produced the message. `origin` on the row says which LANE queued it;
 *  this says which BRAIN wrote it (first-touch and follow-ups both ride origin='sequence'). */
export type RecipeBrain = "first_touch" | "conversation_reply" | "sequence_followup";

export type SendRecipe = {
  /** stamp schema version — bump when the shape changes so old stamps stay parseable */
  v: 2;
  brain: RecipeBrain;
  /** the copy knobs that shaped THIS draft ({} = no strategy directives were applied) */
  strategy: CopyStrategy;
  /** the experiment the lead is enrolled in (null = drafted outside any experiment) */
  experimentId: string | null;
  variant: "champion" | "challenger" | null;
  /** optimization_playbook.version at draft time (null = no playbook / not consulted) */
  playbookVersion: number | null;
  /** how many winning exemplars were injected into the prompt (Stage 0.5 memory) */
  exemplars: number;
  /** registry hash of the system prompt that drafted this message (null = pre-v2 stamp — never backfilled) */
  promptHash: string | null;
  /** resolved model id at draft time (null = pre-v2 stamp — never backfilled) */
  modelId: string | null;
  /**
   * Task 3 (best-of-N judge-ranked selection, enterprise-grade-brain Phase 2C): how many
   * candidates were drafted and judge-ranked to produce this message. ABSENT (not `null`) —
   * not `strategy`/`promptHash`-style honest-null — because the key is only ever written when
   * best-of-N actually ran (n>1 with a judge wired). Every stamp from before Task 3, and every
   * n<=1 stamp after it, keeps the exact shape it always had: the feature is off by default, so
   * its own absence proves nothing ran, rather than needing a sentinel value to say so.
   */
  bestOfN?: number;
};

/** Normalizing constructor: absent facts become honest nulls — never invented. */
export function buildSendRecipe(input: {
  brain: RecipeBrain;
  strategy?: CopyStrategy | null;
  experimentId?: string | null;
  variant?: "champion" | "challenger" | null;
  playbookVersion?: number | null;
  exemplars?: number;
  promptHash?: string | null;
  modelId?: string | null;
  bestOfN?: number;
}): SendRecipe {
  const recipe: SendRecipe = {
    v: 2,
    brain: input.brain,
    strategy: input.strategy ?? {},
    experimentId: input.experimentId ?? null,
    variant: input.variant ?? null,
    playbookVersion: input.playbookVersion ?? null,
    exemplars: Math.max(0, Math.floor(input.exemplars ?? 0)),
    promptHash: input.promptHash ?? null,
    modelId: input.modelId ?? null,
  };
  // Only ever set the key when the caller actually passed it (best-of-N ran) — omitted
  // entirely otherwise, so every non-best-of-N caller's stamp shape is untouched (see the
  // `bestOfN` doc comment on SendRecipe above).
  if (input.bestOfN !== undefined) recipe.bestOfN = input.bestOfN;
  return recipe;
}
