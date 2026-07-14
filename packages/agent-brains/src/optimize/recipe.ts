import type { CopyStrategy } from "../copy/shared";

/**
 * Message-level recipe attribution (Vera Stage 1, spec 2026-07-14). Every agent-drafted
 * message is stamped at draft time with the recipe that produced it, so outcomes can be
 * joined to the exact approach — the data spine the bandit loop will stand on. Pure.
 */

/** Which drafting brain produced the message. `origin` on the row says which LANE queued it;
 *  this says which BRAIN wrote it (first-touch and follow-ups both ride origin='sequence'). */
export type RecipeBrain = "first_touch" | "conversation_reply" | "sequence_followup";

export type SendRecipe = {
  /** stamp schema version — bump when the shape changes so old stamps stay parseable */
  v: 1;
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
};

/** Normalizing constructor: absent facts become honest nulls — never invented. */
export function buildSendRecipe(input: {
  brain: RecipeBrain;
  strategy?: CopyStrategy | null;
  experimentId?: string | null;
  variant?: "champion" | "challenger" | null;
  playbookVersion?: number | null;
  exemplars?: number;
}): SendRecipe {
  return {
    v: 1,
    brain: input.brain,
    strategy: input.strategy ?? {},
    experimentId: input.experimentId ?? null,
    variant: input.variant ?? null,
    playbookVersion: input.playbookVersion ?? null,
    exemplars: Math.max(0, Math.floor(input.exemplars ?? 0)),
  };
}
