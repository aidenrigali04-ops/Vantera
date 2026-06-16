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
  /** filenames/links from Add Content — referenced, never attached in first touch */
  contentLinks?: string[];
  /** the seller's company name — so the caller can honestly say "this is {rep} from {company}" */
  accountName?: string | null;
  accountIndustry?: string | null;
  /** what the seller offers (website-scan summary) */
  valueProp?: string | null;
  /** how the agent should sound — tone/personality/brand voice (style only, never overrides compliance) */
  brandVoice?: string | null;
  /** things the agent must never say or do — topics, claims, or words to avoid */
  guardrails?: string | null;
}

export interface DraftInput {
  lead: CopyLead;
  insights: StoredInsights;
  context: CopyContext;
}

/** Compact per-lead block shared by both copy brains; context first for prompt caching. */
export function leadBlock({ lead, insights, context }: DraftInput): string {
  const name = [lead.firstName, lead.lastName].filter(Boolean).join(" ") || "unknown";
  return [
    context.accountName ? `Seller company: ${context.accountName}` : null,
    `Seller industry: ${context.accountIndustry ?? "unknown"}`,
    `Seller offer: ${context.valueProp ?? "unknown"}`,
    `CTA goal: ${context.cta}`,
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
