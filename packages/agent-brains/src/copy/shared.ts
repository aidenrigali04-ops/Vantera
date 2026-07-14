import type { StoredInsights } from "../prospect/schema";
import { describeViolations, type Violation } from "./humanizer";

export interface CopyLead {
  firstName?: string | null;
  lastName?: string | null;
  title?: string | null;
  companyName?: string | null;
  industry?: string | null;
}

export interface CopyContext {
  /** the user's CTA from the Copy agent wizard, e.g. "book a 15-min intro" */
  cta: string;
  /** the seller's meeting-booking URL — the conversation brain offers it ONCE when the
   *  prospect shows interest in talking; the only way a chat converts without ping-pong */
  bookingUrl?: string | null;
  /** the seller's destination page (site, portfolio, product) — offered ONCE when the prospect
   *  wants to SEE or learn more rather than talk; the conversion path for traffic-first
   *  businesses that don't book calls for revenue */
  websiteUrl?: string | null;
  /** filenames/links from Add Content — referenced, never attached in first touch */
  contentLinks?: string[];
  /** openers/CTA phrasings from the account's recent sends — injected as "do not reuse" so
   *  a batch of drafts doesn't converge on the model's favorite template (AI-detectable
   *  messaging is the #1 churn driver in the category). NEVER part of grounding. */
  avoidPhrases?: string[];
  /** the seller's company name — so the caller can honestly say "this is {rep} from {company}" */
  accountName?: string | null;
  accountIndustry?: string | null;
  /** what the seller offers (website-scan summary) */
  valueProp?: string | null;
  /** how the agent should sound — tone/personality/brand voice (style only, never overrides compliance) */
  brandVoice?: string | null;
  /** things the agent must never say or do — topics, claims, or words to avoid */
  guardrails?: string | null;
  /** the account's citable proof/pricing/FAQ facts (0047). Rendered into the grounding so the brain
   *  can answer "prove it / what's the price" truthfully — and so findUngroundedClaims whitelists any
   *  metric quoted from one. The seller attests these are true; the brain never invents beyond them. */
  proofPoints?: ProofPoint[];
  /**
   * Optional per-variant copy strategy from the self-optimizing loop (Phase 3). Steers HOW the
   * message is written, never WHAT is claimed (facts + compliance are unchanged). Absent for the
   * champion baseline, so generation is identical to pre-optimizer behavior when unset.
   */
  strategy?: CopyStrategy;
}

/**
 * Structured, bounded copy knobs an experiment may vary — never free-form prompt edits. Each is a
 * single stylistic lever; a challenger changes exactly one. Every field is optional; an empty/absent
 * strategy adds no directives (the champion baseline).
 */
export type CopyStrategy = {
  /** what the first touch leads with */
  openWith?: "trigger" | "pain";
  /** follow-up length target */
  followupLength?: "tight" | "standard";
  /** the register of the ask */
  askStyle?: "soft" | "specific";
};

const STRATEGY_LINES: Record<string, string> = {
  "openWith:trigger": "Open by naming the prospect's specific trigger or recent activity before anything else.",
  "openWith:pain": "Open from the prospect's core pain, framed as the outcome they want.",
  "followupLength:tight": "Make the follow-up a single, ruthlessly tight sentence.",
  "followupLength:standard": "", // the default register — no extra directive
  "askStyle:soft": "Keep the ask a soft, low-pressure interest check, never a meeting demand.",
  "askStyle:specific": "Make the ask one concrete next step: propose a specific short call.",
};

/**
 * Render a strategy as extra prompt directives, appended AFTER the base rules so it never overrides
 * compliance/humanity. Returns "" for an absent or no-op strategy, so a champion draft is prompted
 * byte-for-byte the same as before the optimizer existed.
 */
export function strategyDirectives(strategy?: CopyStrategy): string {
  if (!strategy) return "";
  const lines: string[] = [];
  for (const [key, value] of Object.entries(strategy)) {
    if (!value) continue;
    const line = STRATEGY_LINES[`${key}:${value}`];
    if (line) lines.push(`- ${line}`);
  }
  if (lines.length === 0) return "";
  return `Strategy for this message (apply in addition to the rules above, never overriding them):\n${lines.join("\n")}`;
}

/** One citable seller fact (0047). `kind` steers when the brain reaches for it; `question` is the
 *  objection an `faq` fact answers. Text is quoted verbatim, never invented beyond. */
export interface ProofPoint {
  kind: "metric" | "outcome" | "pricing" | "faq";
  text: string;
  question?: string | null;
}

export interface DraftInput {
  lead: CopyLead;
  insights: StoredInsights;
  context: CopyContext;
}

const PROOF_LABEL: Record<ProofPoint["kind"], string> = {
  metric: "proof",
  outcome: "result",
  pricing: "pricing",
  faq: "faq",
};

/**
 * Render the account's proof facts into the grounding. Because these lines live in the leadBlock
 * string, findUngroundedClaims whitelists any metric the message quotes from them. The inline rule
 * keeps them a mid-conversation tool used sparingly — never a first-touch stat dump.
 */
export function proofSection(points?: ProofPoint[]): string | null {
  const list = (points ?? []).filter((p) => p.text?.trim());
  if (list.length === 0) return null;
  const lines = list.map((p) =>
    p.kind === "faq" && p.question?.trim()
      ? `- (faq) if they ask "${p.question.trim()}": ${p.text.trim()}`
      : `- (${PROOF_LABEL[p.kind]}) ${p.text.trim()}`
  );
  return [
    `Proof you may cite, ONLY when the prospect asks for evidence or price or it genuinely strengthens your point (never in a first message, never more than one at a time, quote it as written, and never state a number or claim beyond these. If they ask for something not here, say you don't have that rather than guessing):`,
    ...lines,
  ].join("\n");
}

/**
 * The voice contract shared by every prospect-facing message (first touch, follow-up,
 * mid-conversation). Interpolated into each system prompt so the surfaces can't drift apart,
 * and written dash-free on purpose: prompt prose primes output style, so instructions that
 * lean on em-dashes teach the model to write them. The humanizer enforces the hard rules
 * deterministically (zero dashes, no semicolons, no lists, banned vocabulary).
 */
export const VOICE_RULES = `Voice, for every message:
- Write like you'd text a sharp colleague you respect. Plain, warm, specific. Use contractions (you're, that's, we've).
- Short and flowing. One thought per sentence. Cut every word that isn't pulling weight.
- NEVER use a dash of any kind as punctuation. No em-dashes, no hyphens between clauses. Use a comma, or start a new sentence. No semicolons, no bullet points, no numbered lists.
- Everyday words over business words. Say "use" not "utilize" or "leverage", "help" not "empower", "look into" not "delve". Never: streamline, elevate, seamless, game-changer, thrilled, kudos.
- No "Dear", no "Best regards", no signature, no generic flattery, at most one exclamation mark, minimal hedging.
- Read it back as if it were a text message. If it sounds like marketing, a template, or an assistant, rewrite it plainer and shorter.`;

/**
 * Factual-accuracy contract about the PROSPECT's business, shared by every prospect-facing prompt.
 * Separate from VOICE_RULES (that's style; this is truth). Anchors the message on the prospect's
 * own title/offering so the seller's offer never gets projected onto them — the "we run LinkedIn
 * lead gen for 10-20 founders" misread of a prospect who actually SELLS inbound-lead services
 * (Tejas C, ConnectSafely.ai, 2026-07-09). Because it points at the raw title (always in the
 * block), it also corrects leads ranked before prospect_offering existed.
 */
export const PROSPECT_ACCURACY_RULE = `Getting their business right, for every message:
- When you mention what the prospect does, use THEIR OWN words from their title and "What they do". Never describe their business as if it were the seller's offer, never change their numbers, and never flip the direction of what they do (bringing in leads vs sending outreach, buyer vs seller, inbound vs outbound).
- If the "Value angle" seems to contradict their own title, trust their title. When you are not sure what they do, refer to their work only in the vaguest true terms, or not at all. Misdescribing their business ends the conversation, every time.`;

/**
 * "Do not reuse" block for recent phrasings — appended to the PROMPT only, never to the
 * grounding string (old messages may contain metrics that would falsely whitelist new claims).
 */
export function avoidBlock(avoidPhrases?: string[]): string {
  const phrases = (avoidPhrases ?? []).map((p) => p.trim()).filter(Boolean);
  if (phrases.length === 0) return "";
  return [
    `Vary your language. These phrasings were used in this account's recent messages, do NOT reuse or lightly rephrase any of them:`,
    ...phrases.map((p) => `- "${p}"`),
  ].join("\n");
}

/** Compact per-lead block shared by both copy brains; context first for prompt caching. */
export function leadBlock({ lead, insights, context }: DraftInput): string {
  const name = [lead.firstName, lead.lastName].filter(Boolean).join(" ") || "unknown";
  return [
    context.accountName ? `Seller company: ${context.accountName}` : null,
    `Seller industry: ${context.accountIndustry ?? "unknown"}`,
    `Seller offer: ${context.valueProp ?? "unknown"}`,
    `CTA goal: ${context.cta}`,
    context.bookingUrl ? `Booking link (offer ONLY once the prospect shows interest in talking): ${context.bookingUrl}` : null,
    context.websiteUrl ? `Website link (offer ONLY once the prospect wants to see or learn more): ${context.websiteUrl}` : null,
    context.brandVoice ? `Brand voice (match this tone): ${context.brandVoice}` : null,
    context.guardrails ? `Guardrails (never violate): ${context.guardrails}` : null,
    context.contentLinks?.length ? `Supporting content: ${context.contentLinks.join(", ")}` : null,
    proofSection(context.proofPoints),
    ``,
    `Prospect: ${name}, ${lead.title ?? "unknown role"} at ${lead.companyName ?? "unknown"} (${lead.industry ?? "unknown industry"})`,
    insights.prospect_offering ? `What they do (their words, do not restate through our offer): ${insights.prospect_offering}` : null,
    `Pain points: ${insights.pain_points.join("; ") || "unknown"}`,
    `Triggers: ${insights.triggers.join("; ") || "none observed"}`,
    `Motivations: ${insights.motivations.join("; ") || "unknown"}`,
    `Value angle: ${insights.value_angle}`,
    `Aha moment: ${insights.aha_moment}`,
  ]
    .filter((l) => l !== null)
    .join("\n");
}

/** generate → validate → one bounded regenerate; persistent violations are flagged, not hidden. */
export async function generateHumanized<T>(
  run: (fixNote?: string) => Promise<T>,
  validate: (output: T) => Violation[]
): Promise<{ output: T; violations: Violation[] }> {
  const first = await run();
  const firstViolations = validate(first);
  if (firstViolations.length === 0) {
    return { output: first, violations: [] };
  }
  const second = await run(
    `Your previous draft broke these style rules, rewrite and fix every one: ${describeViolations(firstViolations)}`
  );
  return { output: second, violations: validate(second) };
}
