import { generateObject, type LanguageModel } from "ai";
import { z } from "zod";
import { getModel, registerPrompt } from "@vantera/ai";
import type { CopyStrategy } from "../copy/shared";
import { MESSAGE_SHAPES, validateProposedShape } from "../copy/shape";
import type { FunnelStageKey } from "./funnel";
import { proposeNextChallenger } from "./experiment";
import { validateRecipeAngle } from "./angle";
import { strategySignature } from "./bandit";

/**
 * Generate → gate: LLM-proposed recipe candidates for the next experiment (Stage 1b). The model
 * proposes; deterministic gates dispose (claim-risk angles, champion duplicates, signature dupes).
 * The knob-flip baseline is always candidate 0, so the autonomous loop keeps working when the
 * model fails or returns garbage. Pure (model injected).
 */

const candidateSchema = z.object({
  reasoning: z.string(),
  candidates: z.array(
    z.object({
      openWith: z.enum(["trigger", "pain"]).optional(),
      followupLength: z.enum(["tight", "standard"]).optional(),
      askStyle: z.enum(["soft", "specific"]).optional(),
      openerAngle: z.string().optional(),
      // message-shape selector (spec §6): the opener STRUCTURE. z.enum is the closed set;
      // `.catch(undefined)` makes an out-of-set value fall back to undefined (dropped) instead of
      // sinking the WHOLE candidate batch (validate loosely, dispose at the mapping gate — same
      // robustness the openerAngle free-text field relies on). validateProposedShape below then
      // drops the default + gates bold shapes by account pin.
      messageShape: z.enum(MESSAGE_SHAPES).optional().catch(undefined),
    })
  ),
});

export interface GenerateRecipesInput {
  stageKey: FunnelStageKey;
  champion: CopyStrategy;
  /** recent concluded tests (label + adopted/discarded/halted) so ideas aren't re-proposed */
  recentConclusions: { label: string; status: string }[];
  accountIndustry?: string | null;
  /**
   * The `message_shape_auto` app-setting — the MASTER enable for the whole message-shape feature
   * (spec 2026-07-20, review M-gate). OFF (default) ⇒ generation proposes NO messageShape on ANY
   * candidate, so the feature is dormant in the challenger arms too, not just the champion default.
   * Read in the jobs layer (`getMessageShapeAuto`) and passed in — the brain never touches the DB.
   */
  messageShapeAuto?: boolean;
  /** whether this account is pinned into `bold_shapes_account_ids` — only pinned accounts may
   *  explore the bold shapes (provocation/disqualifier/own_cold). Default false ⇒ safe subset only.
   *  Only consulted when `messageShapeAuto` is on (the master switch gates generation entirely). */
  boldShapesAllowed?: boolean;
}

const MAX_CANDIDATES = 6;
const MAX_OUTPUT_TOKENS = 900;

// Stable system prompt (identical across runs → Anthropic prompt caching hits).
const GENERATE_SYSTEM = registerPrompt("optimize/generate", `You propose the next outreach copy experiments for a LinkedIn lead-gen system. Each candidate is a small strategy: optional knobs openWith (trigger|pain), followupLength (tight|standard), askStyle (soft|specific), openerAngle, a SHORT style-only phrase (8-80 chars) describing what to angle the opener around (e.g. "a peer in their niche facing the same pain", "their recent post topic as the doorway"), and messageShape, the STRUCTURE of the opener.

messageShape options: observation_question (the default: thanks, one observation, one question), trigger_consequence (open on a real recent trigger and its downstream consequence), gift (lead with something useful and no ask), peer_insider (the one thing only someone who does their exact job would notice). Bold options provocation, disqualifier, own_cold exist but only propose them if you are told bold shapes are allowed for this account.

Hard rules:
- openerAngle is STYLE ONLY: no numbers, no percentages, no prices, no promises or guarantees, no invented facts. It steers the angle of the first sentence, never what is claimed.
- messageShape is a STRUCTURE, not a claim. Propose a shape ONLY when the lead's signal supports it: do not propose trigger_consequence when there is no trigger, or peer_insider when there is no shared-domain signal. A shape never licenses inventing a fact.
- Propose 3-5 candidates meaningfully different from the current champion and from each other.
- Do not re-propose ideas that were already tested (listed with their outcomes).
- Emit reasoning first (one dense sentence), then the candidates.`);

export async function proposeRecipeCandidates(
  input: GenerateRecipesInput,
  model: LanguageModel = getModel()
): Promise<CopyStrategy[]> {
  const baseline = proposeNextChallenger(input.stageKey, input.champion);
  const out: CopyStrategy[] = baseline ? [baseline] : [];
  const seen = new Set(out.map(strategySignature));
  seen.add(strategySignature(input.champion));

  let generated: z.infer<typeof candidateSchema> | null = null;
  try {
    generated = (
      await generateObject({
        model,
        schema: candidateSchema,
        system: GENERATE_SYSTEM.text,
        prompt: [
          `Funnel stage being tested: ${input.stageKey}`,
          `Current champion strategy: ${JSON.stringify(input.champion)}`,
          `Seller industry: ${input.accountIndustry ?? "unknown"}`,
          `Bold message shapes allowed for this account: ${input.boldShapesAllowed ? "yes" : "no"}`,
          `Already tested (do not re-propose): ${
            input.recentConclusions.map((c) => `${c.label} (${c.status})`).join("; ") || "none"
          }`,
        ].join("\n"),
        maxOutputTokens: MAX_OUTPUT_TOKENS,
      })
    ).object;
  } catch {
    return out; // the loop must never stall on a generation failure
  }

  for (const raw of generated.candidates) {
    if (out.length >= MAX_CANDIDATES) break;
    const c: CopyStrategy = {};
    if (raw.openWith) c.openWith = raw.openWith;
    if (raw.followupLength) c.followupLength = raw.followupLength;
    if (raw.askStyle) c.askStyle = raw.askStyle;
    if (raw.openerAngle !== undefined) {
      const angle = raw.openerAngle.trim();
      if (validateRecipeAngle(angle) !== null) continue; // gated: claim-risk angles never enter
      c.openerAngle = angle;
    }
    // Master gate (review M-gate): messageShape is proposed ONLY when the `message_shape_auto`
    // app-setting is on. OFF ⇒ the knob is never mapped, so no challenger carries a shape and the
    // feature is fully dormant end-to-end (champion default is gated the same way in copy-draft).
    if (raw.messageShape !== undefined && input.messageShapeAuto) {
      // Closed-set gate (spec §6/§7): unknown value dropped, observation_question (the default)
      // dropped, bold shapes dropped unless this account is pinned. A dropped shape simply doesn't
      // set the knob — the candidate can still carry its other knobs.
      const shape = validateProposedShape(raw.messageShape, { allowBold: input.boldShapesAllowed ?? false });
      if (shape) c.messageShape = shape;
    }
    if (Object.keys(c).length === 0) continue;
    const sig = strategySignature(c);
    if (seen.has(sig)) continue;
    seen.add(sig);
    out.push(c);
  }
  return out;
}
