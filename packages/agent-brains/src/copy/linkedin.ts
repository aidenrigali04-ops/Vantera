import { generateObject, type LanguageModel } from "ai";
import { z } from "zod";
import { getModel, registerPrompt } from "@vantera/ai";
import { findMissingWhyNow, type WhyNow } from "./why-now";
import { validateHumanity, findUngroundedClaims, findUngroundedEntities, findTemplateOpener, normalizeDashes, type Violation } from "./humanizer";
import { findRepeatedOpener } from "./opener";
import { avoidBlock, exemplarBlock, generateHumanized, leadBlock, steerBlock, strategyDirectives, PROSPECT_ACCURACY_RULE, VOICE_RULES, type DraftInput } from "./shared";
import { FACT_ASSERTING_SHAPES, groundingHasShapeSignal, shapeBudget, type MessageShape } from "./shape";

/**
 * LinkedIn's hard cap on a connection-request note is 300 chars, but free-tier
 * accounts are limited to 200. We generate AND validate to 200 so a reviewed,
 * approved note is sent verbatim — never truncated mid-word at the send boundary
 * (the send path enforces the same cap; see LINKEDIN_NOTE_MAX in jobs).
 */
export const CONNECTION_NOTE_MAX_CHARS = 200;
// First message after acceptance. Kept short on purpose — a long DM reads like a pitch and gets
// ignored; 1–2 tight sentences earn a reply (500 → 300 on 2026-06-29, → 250 on 2026-07-08, → 180
// on 2026-07-10 owner feedback "the initial outreach message is too long"). Paired with a word cap
// so a draft can't pack length into short words and still read like a wall of text.
export const FOLLOWUP_MAX_CHARS = 180;
export const FOLLOWUP_MAX_WORDS = 28;

export const linkedinDraftSchema = z.object({
  connection_note: z.string().max(300),
  followup_message: z.string().max(600),
});

export interface LinkedInDraft {
  connectionNote: string;
  followupMessage: string;
  /** unresolved humanizer violations — surfaced in the review queue, never silently shipped */
  violations: Violation[];
}

// LinkedIn outreach system prompt. Practices baked in: connection notes that pitch get
// ignored or reported — the note only references the trigger/commonality; the pitch waits
// for the follow-up after acceptance, and even that stays soft. Conversational register,
// no formal sign-offs (it's chat, not email).
// Exported (not just module-local) so the jobs pipeline can stamp SendRecipe.promptHash with
// the EXACT registry hash of the prompt that drafted a first-touch message — it imports this
// handle rather than re-registering, so the two can never drift (recipe.ts v2, WS-3.4).
export const LINKEDIN_SYSTEM = registerPrompt("copy/linkedin", `You write LinkedIn outreach for a B2B seller: a connection note and one follow-up message (sent only after the prospect accepts).

Connection note, under ${CONNECTION_NOTE_MAX_CHARS} characters:
- Reference the prospect's trigger, work, or a genuine commonality. That's all. One short line lands better than two.
- NO pitch, no CTA, no links, no "I'd love to connect about our product". The only goal is an accepted request from a real-sounding peer.

Follow-up message: one or two short sentences, aim for about 120 characters and never exceed ${FOLLOWUP_MAX_CHARS} (about ${FOLLOWUP_MAX_WORDS} words). Shorter always wins. This is the FIRST real exchange, and buyers delete anything long or anything that opens with a pitch, so:
- Do NOT name the seller's company or product. Do NOT list features or describe what the seller does. Do NOT ask for a call, meeting, or demo. All of that comes later, after they engage.
- Shape: open with the one specific thing from the block that is unique to THIS prospect (their why now, their trigger, or what they do), then ask ONE question that only makes sense for them. The question is the whole CTA, so make it easy and interesting to answer. A short thanks is optional and never the first words. Never start with "Thanks for connecting" or "Curious how".
- The question must be about something in their world that the block names (their trigger, their why now, or what they do), not about the seller's category (for example how they handle outbound or prospecting) unless the block shows that is their stated problem. If the block has nothing specific, ask about their own offering, in their own words.
- Do not repeat the connection note's fact. The follow-up builds on it: what it means for them, or the question it raises.
- The "CTA goal" in the block only tells you where the conversation should eventually head. It must NOT appear as an ask in this message.
- If the prospect's location strongly implies a primary language other than English, writing in that language is welcome.

${PROSPECT_ACCURACY_RULE}

${VOICE_RULES}

If you ever reference the seller, use ONLY the "Seller company" value from the block, never any other brand name from the offer description.`);

// `grounding` is the per-lead facts (leadBlock). When provided, both messages are checked for
// fabricated metric claims (rule 11 / anti-hallucination); unresolved ones surface in review.
// `sellerName` enforces the de-pitched first touch: naming the product in message 1 is the
// "pitch slap" buyers cite as the top delete trigger (2026-07-08 copy analysis).
//
// `shape` (message-shape selector, spec 2026-07-20) governs ONLY the follow-up length budget and
// the grounding guard below. It is STRUCTURE, not a compliance escape: the de-pitch rules
// (no link, no product name, no meeting ask) and the full humanizer run on EVERY shape unchanged —
// a shape can never buy its way past them. Unset OR "observation_question" ⇒ the exact 180/28
// follow-up budget as before the selector existed (byte-identical default).
export function validateLinkedInDraft(
  draft: {
    connection_note: string;
    followup_message: string;
  },
  grounding?: string,
  sellerName?: string | null,
  shape?: MessageShape | null,
  whyNow?: WhyNow | null,
  identity?: string | null,
  /** recent opener skeletons (account sends + exemplars + this run) — code-enforced anti-repeat */
  avoidSkeletons?: readonly string[] | null,
): Violation[] {
  const budget = shapeBudget(shape);
  const tag = (part: "invite" | "message", vs: Violation[]): Violation[] => vs.map((v) => ({ ...v, part }));
  const note = draft.connection_note;
  const msg = draft.followup_message;
  const violations: Violation[] = [
    ...tag("invite", validateHumanity(note, { maxChars: CONNECTION_NOTE_MAX_CHARS })),
    ...tag("message", validateHumanity(msg, { maxChars: budget.maxChars, maxWords: budget.maxWords })),
  ];
  if (/https?:\/\//i.test(note)) {
    violations.push({ rule: "no-links", detail: "no links in a connection note", part: "invite" });
  }
  // Copy-quality fix (2026-10-21): the follow-up must open on THIS prospect, never on the stock
  // "Thanks for connecting / Curious how" template, and never on a recent message's first words.
  violations.push(...tag("message", findTemplateOpener(msg)));
  violations.push(...tag("message", findRepeatedOpener(msg, avoidSkeletons, identity)));
  // ML-3: a verified why-now is the reason to reach out — the note must reference it.
  violations.push(...tag("invite", findMissingWhyNow(note, whyNow, identity)));
  // The first follow-up is a soft, human ask — a raw link makes it read like a pitch (content is
  // referenced, never pasted in the first touch). Same anti-pitch discipline as the note.
  if (/https?:\/\//i.test(msg)) {
    violations.push({ rule: "no-links", detail: "no links in the first follow-up — keep it a soft ask", part: "message" });
  }
  // Touch 1 earns a conversation; it never sells. Product name or a meeting ask here is the
  // classic pitch-slap — enforced, not just prompted.
  if (sellerName && sellerName.trim().length > 2 && msg.toLowerCase().includes(sellerName.trim().toLowerCase())) {
    violations.push({ rule: "no-product-pitch", detail: `the first message must not name ${sellerName.trim()} — earn the conversation first`, part: "message" });
  }
  if (/\b(?:a\s+(?:quick\s+)?call|meeting|demo|calendar|15\s*-?\s*min)\b/i.test(msg)) {
    violations.push({ rule: "no-meeting-ask", detail: "no call/meeting ask in the first message — the question IS the CTA", part: "message" });
  }
  if (grounding) {
    violations.push(
      ...tag("invite", [...findUngroundedClaims(note, grounding), ...findUngroundedEntities(note, grounding)]),
      ...tag("message", [...findUngroundedClaims(msg, grounding), ...findUngroundedEntities(msg, grounding)]),
    );
    // Deterministic grounding guard (spec §5c, anti-hallucination layer 3): a fact-asserting shape
    // (trigger_consequence / gift / peer_insider) leans its whole framing on a specific prospect
    // fact. If the shape was applied but the grounding block does NOT carry that signal, the premise
    // was never real — route to review rather than trust it. The shape governs the follow-up.
    if (shape && FACT_ASSERTING_SHAPES.includes(shape) && !groundingHasShapeSignal(grounding, shape)) {
      violations.push({
        rule: "shape-signal-missing",
        detail: `the ${shape} shape asserts a specific fact, but the grounding has no matching signal — do not use this framing without it`,
        part: "message",
      });
    }
  }
  return violations;
}

/** The prospect's own name + company words — excluded from why-now citation matching. */
export function leadIdentity(lead: DraftInput["lead"]): string {
  return [lead.firstName, lead.lastName, lead.companyName].filter(Boolean).join(" ");
}

export type LinkedInStage = "invite" | "message";

/**
 * Single prompt-assembly path for draftLinkedIn and regenerateLinkedInStage so they cannot drift.
 * `grounding` is the leadBlock ALONE: strategy, avoid, exemplar and steer blocks are prompt-only
 * and never add facts, so an old metric or a steer number can never whitelist a new claim.
 */
function assemblePrompt(input: DraftInput, steer: string | null): { grounding: string; basePrompt: string } {
  const grounding = leadBlock(input);
  const basePrompt = [
    grounding,
    strategyDirectives(input.context.strategy),
    avoidBlock(input.context.avoidPhrases),
    exemplarBlock(input.context.winningExemplars),
    steerBlock(steer),
  ]
    .filter(Boolean)
    .join("\n\n");
  return { grounding, basePrompt };
}

async function runLinkedIn(input: DraftInput, steer: string | null, model: LanguageModel): Promise<LinkedInDraft> {
  const { grounding, basePrompt } = assemblePrompt(input, steer);
  // The chosen shape governs the follow-up length budget + the grounding guard in the validator.
  // Unset ⇒ shapeBudget falls back to the exact 180/28 default (byte-identical).
  const shape = input.context.strategy?.messageShape;
  const { output, violations } = await generateHumanized(
    async (fixNote) => {
      const obj = (
        await generateObject({
          model,
          schema: linkedinDraftSchema,
          system: LINKEDIN_SYSTEM.text,
          prompt: fixNote ? `${basePrompt}\n\n${fixNote}` : basePrompt,
          maxOutputTokens: 600,
        })
      ).object;
      // Fix stray em-dashes deterministically before linting (both fields).
      return {
        connection_note: normalizeDashes(obj.connection_note),
        followup_message: normalizeDashes(obj.followup_message),
      };
    },
    (draft) =>
      validateLinkedInDraft(draft, grounding, input.context.accountName, shape, input.lead.whyNow, leadIdentity(input.lead), input.context.avoidSkeletons)
  );
  return { connectionNote: output.connection_note, followupMessage: output.followup_message, violations };
}

/** LinkedIn copy system: personalized connection note + post-accept follow-up per lead. */
export function draftLinkedIn(input: DraftInput, model: LanguageModel = getModel()): Promise<LinkedInDraft> {
  return runLinkedIn(input, null, model);
}

/**
 * Re-roll one stage with an optional owner steer (prompt-only). Runs the same generate → lint →
 * bounded re-roll flow as draftLinkedIn. It generates BOTH fields and discards the other one
 * (token cost accepted). Violations are filtered to this stage (untagged ones are kept).
 */
export async function regenerateLinkedInStage(
  input: DraftInput,
  stage: LinkedInStage,
  steer: string | null,
  model: LanguageModel = getModel()
): Promise<{ text: string; violations: Violation[] }> {
  const d = await runLinkedIn(input, steer, model);
  return { text: stage === "invite" ? d.connectionNote : d.followupMessage, violations: d.violations.filter((v) => v.part === stage || v.part === undefined) };
}
