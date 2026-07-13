import { z } from "zod";

/**
 * Per-lead structured output of the AI rank (rule 06 stage 2). `reasoning` comes
 * FIRST: a short forced deliberation before the score — most of the quality of
 * extended thinking at a fraction of the output tokens.
 *
 * The schema is intentionally PERMISSIVE (no length/range caps): the model can't
 * reliably honor exact char limits, and a single over-long field used to fail the
 * WHOLE batch (AI_NoObjectGeneratedError). Length/range discipline lives in the
 * system prompt for guidance and in `normalizeInsights` for enforcement — validate
 * loosely, normalize strictly.
 */
export const leadInsightsSchema = z.object({
  lead_id: z.string(),
  reasoning: z.string(),
  score: z.number(),
  /** dashboard one-liner (leads.ai_rationale) */
  rationale: z.string(),
  pain_points: z.array(z.string()),
  triggers: z.array(z.string()),
  motivations: z.array(z.string()),
  /** what the PROSPECT's own company/role does, in their own terms — grounded strictly in their
   *  title/company/signals, never the seller's offer. Separated from value_angle so the two
   *  businesses can't fuse (the "we run lead gen for 10-20 founders" misread, 2026-07-09). */
  prospect_offering: z.string(),
  value_angle: z.string(),
  aha_moment: z.string(),
  /** user-facing tailored enrichment summary (leads.ai_insights.summary) */
  summary: z.string(),
});

export const rankBatchSchema = z.object({
  leads: z.array(leadInsightsSchema),
});

export type LeadInsights = z.infer<typeof leadInsightsSchema>;

const clamp = (s: string, max: number): string => (s.length > max ? s.slice(0, max).trimEnd() : s);

/**
 * Enforce the field caps the schema no longer hard-validates: clamp the score to 0-100,
 * cap each list at 3 items, and truncate each free-text field to its documented length.
 * Applied to every ranked lead before scores/insights are persisted.
 */
export function normalizeInsights(i: LeadInsights): LeadInsights {
  return {
    lead_id: i.lead_id,
    reasoning: clamp(i.reasoning, 300),
    score: Math.max(0, Math.min(100, Math.round(i.score))),
    rationale: clamp(i.rationale, 280),
    pain_points: i.pain_points.slice(0, 3),
    triggers: i.triggers.slice(0, 3),
    motivations: i.motivations.slice(0, 3),
    prospect_offering: clamp(i.prospect_offering, 220),
    value_angle: clamp(i.value_angle, 200),
    aha_moment: clamp(i.aha_moment, 200),
    summary: clamp(i.summary, 400),
  };
}

/** Shape persisted to leads.ai_insights (everything except score/rationale, which get columns). */
export function toStoredInsights(insights: LeadInsights): StoredInsights {
  return {
    pain_points: insights.pain_points,
    triggers: insights.triggers,
    motivations: insights.motivations,
    prospect_offering: insights.prospect_offering,
    value_angle: insights.value_angle,
    aha_moment: insights.aha_moment,
    summary: insights.summary,
  };
}

export interface StoredInsights {
  pain_points: string[];
  triggers: string[];
  motivations: string[];
  value_angle: string;
  aha_moment: string;
  summary: string;
  /** what the prospect's OWN company/role does, in their terms (rank field added 2026-07-10).
   *  Optional: leads ranked before this field predate it — consumers fall back to the raw title. */
  prospect_offering?: string;
}
