import { generateObject, type LanguageModel } from "ai";
import { z } from "zod";
import { getModel } from "@vantera/ai";
import { stripLoneSurrogates } from "../text";

// Permissive schema (validate loose, normalize strict — see prospect/rank). The model returns
// one verdict per observation ref; we keep only known refs and cap field lengths in code.
export const intentVerdictSchema = z.object({
  ref: z.string(),
  reasoning: z.string(),
  is_intent: z.boolean(),
  level: z.enum(["high", "medium", "low", "none"]),
  why_now: z.string(),
});
export const intentBatchSchema = z.object({ verdicts: z.array(intentVerdictSchema) });
export type IntentVerdict = z.infer<typeof intentVerdictSchema>;

/** One LinkedIn observation to judge for buying intent. */
export interface IntentObservationInput {
  /** stable ref (the engager/poster profile url) — the model echoes it back */
  ref: string;
  name?: string | null;
  headline?: string | null;
  signalKind: "engagement" | "content";
  /** "commented", "reacted", or "posted" */
  action: string;
  /** the post text (engagement: the post they reacted to; content: their own post) */
  text: string;
  /** what the agent was watching that surfaced this (a creator, competitor, keyword, hashtag) */
  watchTarget?: string | null;
}

export interface IntentContext {
  /** the customer's own industry (accounts.onboarding_industry) */
  accountIndustry?: string | null;
  /** what the seller offers — website-scan summary + value props */
  valueProp?: string | null;
}

/** Observations per model call — verdicts are tiny, so batch generously. */
export const INTENT_BATCH_SIZE = 15;
const MAX_OUTPUT_TOKENS = 4000;
const trunc = (s: string, max: number) => (s.length > max ? `${s.slice(0, max - 1)}…` : s);

// Stable system prompt (rubric + output contract) so Anthropic prompt caching hits across
// batches; per-batch content rides in the user message only.
const INTENT_SYSTEM = `You are the buying-intent brain of a LinkedIn SDR platform. You receive a seller context block and a batch of LinkedIn observations (someone engaged with or published a post). Decide whether each person is showing genuine buying intent FOR THE SELLER'S OFFER right now — not generic engagement.

Rubric:
- high: explicitly seeking, asking for, or describing the exact problem the seller solves (e.g. "anyone recommend a tool for X", "we keep struggling with X").
- medium: actively engaging with the seller's problem space in a way that implies they have the problem.
- low: tangential — same broad topic but no signal they're in-market.
- none: unrelated, off-topic, or pure social noise. Most bare reactions are none.

For each observation emit: ref (copy it exactly), reasoning (one sentence weighing the text against the seller's offer — think here before deciding), is_intent (true ONLY for high/medium), level, why_now (one plain-English line a rep reads — paraphrase what THIS person actually did, e.g. "commented asking for a churn tool on a RevOps post"). Ground why_now in the observed text; never invent a detail that isn't there.`;

function contextBlock(ctx: IntentContext): string {
  return [
    `Seller industry: ${ctx.accountIndustry ?? "unknown"}`,
    `Seller offer: ${ctx.valueProp ?? "unknown"}`,
  ].join("\n");
}

function compactObservation(o: IntentObservationInput): string {
  return [
    o.ref,
    o.signalKind,
    o.action,
    o.headline ? trunc(o.headline, 50) : "-",
    o.watchTarget ? `watch:${trunc(o.watchTarget, 30)}` : "-",
    trunc(o.text.replace(/\s+/g, " "), 280) || "-",
  ].join(" | ");
}

/** is_intent stays coherent with level (only high/medium count); cap free-text fields. */
export function normalizeVerdict(v: IntentVerdict): IntentVerdict {
  return {
    ref: v.ref,
    reasoning: trunc(v.reasoning, 300),
    is_intent: v.is_intent && (v.level === "high" || v.level === "medium"),
    level: v.level,
    why_now: trunc(v.why_now, 200),
  };
}

async function classifyBatch(
  batch: IntentObservationInput[],
  ctx: IntentContext,
  model: LanguageModel
): Promise<IntentVerdict[]> {
  // strip lone surrogates from the scraped post text — they 400 the model API as invalid JSON
  const prompt = stripLoneSurrogates(
    `${contextBlock(ctx)}\n\nObservations (ref | kind | action | headline | watch | text):\n${batch
      .map(compactObservation)
      .join("\n")}`
  );
  const run = () =>
    generateObject({ model, schema: intentBatchSchema, system: INTENT_SYSTEM, prompt, maxOutputTokens: MAX_OUTPUT_TOKENS });

  let verdicts: IntentVerdict[];
  try {
    verdicts = (await run()).object.verdicts;
  } catch {
    // one retry on schema/generation failure, then let the error surface
    verdicts = (await run()).object.verdicts;
  }
  const known = new Set(batch.map((o) => o.ref));
  return verdicts.filter((v) => known.has(v.ref)).map(normalizeVerdict);
}

/**
 * Classify a batch of LinkedIn observations for genuine buying intent — the filter that runs
 * BEFORE ICP qualification (rules-gate + rank), so enrichment spend never lands on social noise,
 * and the why_now line feeds the lead's "why now" chip. Empty-text observations are judged "none"
 * deterministically (no readable signal to weigh).
 */
export async function classifyIntent(
  observations: IntentObservationInput[],
  ctx: IntentContext,
  model: LanguageModel = getModel()
): Promise<IntentVerdict[]> {
  const results: IntentVerdict[] = [];
  for (const o of observations) {
    if (o.text.trim().length === 0) {
      results.push({ ref: o.ref, reasoning: "no readable post text", is_intent: false, level: "none", why_now: "" });
    }
  }
  const readable = observations.filter((o) => o.text.trim().length > 0);
  for (let i = 0; i < readable.length; i += INTENT_BATCH_SIZE) {
    results.push(...(await classifyBatch(readable.slice(i, i + INTENT_BATCH_SIZE), ctx, model)));
  }
  return results;
}
