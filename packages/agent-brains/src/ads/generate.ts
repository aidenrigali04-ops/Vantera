import { generateObject, type LanguageModel } from "ai";
import { getModel } from "@vantera/ai";
import { findUngroundedClaims, type Violation } from "../copy/humanizer";
import { adConceptBatchSchema, type AdConcept } from "./schema";

/**
 * Ad-concept brain (Phase 11 — Meta Ads generation, rule 01 key initiative). Generates a handful
 * of on-brand ad concepts (copy + a creative prompt) for a lead-gen / traffic ad, grounded in the
 * seller's offer and target. The same anti-hallucination guardrail as the copy/caller brains
 * applies: a concept that invents a metric absent from the grounding is flagged, never shipped
 * silently (report #6 — fabricated proof is what sank trust in the category). Pure: model +
 * generate fn injected for tests (rule 13).
 */

export interface AdConceptInput {
  accountName: string | null;
  accountIndustry: string | null;
  /** what the seller actually does — website-scan summary / value prop */
  valueProp: string | null;
  /** the specific offer or lead magnet this ad promotes (user input) */
  offer: string;
  /** who the ad targets — an ICP description (inherited from the Scout) */
  targetIcp: string;
  /** the goal a click / form-fill leads to */
  cta: string;
  /** optional creative angle/theme the user wants explored */
  angle?: string;
  /** how many concepts to generate (default 3) */
  variants?: number;
}

const AD_SYSTEM = `You write Meta (Facebook/Instagram) lead-gen ad concepts for a B2B seller. You get a seller/offer/target block; write distinct ad concepts.

Per concept:
- headline — under 40 chars: the single sharpest promise to the target, in their language (the business result, not features). No clickbait, no ALL CAPS, no emoji spam.
- primary_text — 1–2 short sentences: name the target's problem, then the offer as the relief. Plain, specific, scroll-stopping. Vary angle across concepts (pain, outcome, curiosity).
- description — optional, under 40 chars: a supporting line for the link.
- cta — pick the Meta button that matches the offer (SIGN_UP / GET_QUOTE / LEARN_MORE / DOWNLOAD / CONTACT_US / SUBSCRIBE / GET_OFFER).
- creative_prompt — under 300 chars: a concrete visual brief for an image/video generator that matches the concept's angle. Describe the scene, mood, and subject; no text overlays.

Hard rules:
- NEVER invent a statistic, percentage, dollar figure, customer name, or case study. If you didn't get a number in the block, don't write one. Make the promise without fake proof.
- Plain human voice: no "game-changer", "revolutionary", "unlock", "supercharge", "seamless"; minimal hyperbole; at most one exclamation mark across a concept.
- Honest: no fake urgency or scarcity, no guaranteed outcomes.
- Match the offer to the target — every concept is for the same offer, just a different angle.`;

/** Seller/offer/target block — the grounding the ad copy is checked against. */
export function adContextBlock(input: AdConceptInput): string {
  return [
    input.accountName ? `Seller company: ${input.accountName}` : null,
    `Seller industry: ${input.accountIndustry ?? "unknown"}`,
    `Seller offer (what they do): ${input.valueProp ?? "unknown"}`,
    `This ad's offer: ${input.offer}`,
    `Target audience: ${input.targetIcp}`,
    `Goal (what a click leads to): ${input.cta}`,
    input.angle ? `Creative angle to explore: ${input.angle}` : null,
  ]
    .filter((l) => l !== null)
    .join("\n");
}

export interface AdConceptResult {
  concepts: AdConcept[];
  /** fabricated-metric claims absent from the offer block — surfaced for review, never auto-published */
  violations: Violation[];
}

export async function generateAdConcepts(
  input: AdConceptInput,
  model: LanguageModel = getModel(),
  generate: typeof generateObject = generateObject
): Promise<AdConceptResult> {
  const block = adContextBlock(input);
  const variants = input.variants ?? 3;
  const { object } = await generate({
    model,
    schema: adConceptBatchSchema,
    system: AD_SYSTEM,
    prompt: `Write ${variants} distinct ad concepts for the same offer below.\n\n${block}`,
    maxOutputTokens: 1500,
  });
  // Ground every prospect-facing line (headline + primary text + description) against the offer
  // block; the creative prompt is internal (never shown to a prospect), so it isn't checked.
  const copy = object.concepts
    .flatMap((c) => [c.headline, c.primaryText, c.description])
    .filter((s): s is string => Boolean(s))
    .join("\n");
  return { concepts: object.concepts, violations: findUngroundedClaims(copy, block) };
}
