import { generateObject, type LanguageModel } from "ai";
import { z } from "zod";
import { getModel, registerPrompt } from "@vantera/ai";
import type { CopyStrategy } from "../copy/shared";
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
    })
  ),
});

export interface GenerateRecipesInput {
  stageKey: FunnelStageKey;
  champion: CopyStrategy;
  /** recent concluded tests (label + adopted/discarded/halted) so ideas aren't re-proposed */
  recentConclusions: { label: string; status: string }[];
  accountIndustry?: string | null;
}

const MAX_CANDIDATES = 6;
const MAX_OUTPUT_TOKENS = 900;

// Stable system prompt (identical across runs → Anthropic prompt caching hits).
const GENERATE_SYSTEM = registerPrompt("optimize/generate", `You propose the next outreach copy experiments for a LinkedIn lead-gen system. Each candidate is a small strategy: optional knobs openWith (trigger|pain), followupLength (tight|standard), askStyle (soft|specific), and openerAngle, a SHORT style-only phrase (8-80 chars) describing what to angle the opener around (e.g. "a peer in their niche facing the same pain", "their recent post topic as the doorway").

Hard rules:
- openerAngle is STYLE ONLY: no numbers, no percentages, no prices, no promises or guarantees, no invented facts. It steers the angle of the first sentence, never what is claimed.
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
    if (Object.keys(c).length === 0) continue;
    const sig = strategySignature(c);
    if (seen.has(sig)) continue;
    seen.add(sig);
    out.push(c);
  }
  return out;
}
