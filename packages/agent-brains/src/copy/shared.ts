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
  "askStyle:soft": "Keep the ask a soft, low-pressure interest check — no meeting demand.",
  "askStyle:specific": "Make the ask one concrete next step — propose a specific short call.",
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
  return `Strategy for this message (apply in addition to — never overriding — the rules above):\n${lines.join("\n")}`;
}

export interface DraftInput {
  lead: CopyLead;
  insights: StoredInsights;
  context: CopyContext;
}

/**
 * "Do not reuse" block for recent phrasings — appended to the PROMPT only, never to the
 * grounding string (old messages may contain metrics that would falsely whitelist new claims).
 */
export function avoidBlock(avoidPhrases?: string[]): string {
  const phrases = (avoidPhrases ?? []).map((p) => p.trim()).filter(Boolean);
  if (phrases.length === 0) return "";
  return [
    `Vary your language. These phrasings were used in this account's recent messages — do NOT reuse or lightly rephrase any of them:`,
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
    context.brandVoice ? `Brand voice (match this tone): ${context.brandVoice}` : null,
    context.guardrails ? `Guardrails (never violate): ${context.guardrails}` : null,
    context.contentLinks?.length ? `Supporting content: ${context.contentLinks.join(", ")}` : null,
    ``,
    `Prospect: ${name}, ${lead.title ?? "unknown role"} at ${lead.companyName ?? "unknown"} (${lead.industry ?? "unknown industry"})`,
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
    `Your previous draft broke these style rules — rewrite and fix every one: ${describeViolations(firstViolations)}`
  );
  return { output: second, violations: validate(second) };
}
