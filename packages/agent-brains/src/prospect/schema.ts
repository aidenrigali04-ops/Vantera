import { z } from "zod";

/**
 * Per-lead structured output of the AI rank (rule 06 stage 2). `reasoning` comes
 * FIRST: a short forced deliberation before the score — most of the quality of
 * extended thinking at a fraction of the output tokens.
 */
export const leadInsightsSchema = z.object({
  lead_id: z.string(),
  reasoning: z.string().max(300),
  score: z.number().min(0).max(100),
  /** dashboard one-liner (leads.ai_rationale) */
  rationale: z.string().max(280),
  pain_points: z.array(z.string()).max(3),
  triggers: z.array(z.string()).max(3),
  motivations: z.array(z.string()).max(3),
  value_angle: z.string().max(200),
  aha_moment: z.string().max(200),
  /** user-facing tailored enrichment summary (leads.ai_insights.summary) */
  summary: z.string().max(400),
});

export const rankBatchSchema = z.object({
  leads: z.array(leadInsightsSchema),
});

export type LeadInsights = z.infer<typeof leadInsightsSchema>;

/** Shape persisted to leads.ai_insights (everything except score/rationale, which get columns). */
export function toStoredInsights(insights: LeadInsights) {
  return {
    pain_points: insights.pain_points,
    triggers: insights.triggers,
    motivations: insights.motivations,
    value_angle: insights.value_angle,
    aha_moment: insights.aha_moment,
    summary: insights.summary,
  };
}

export type StoredInsights = ReturnType<typeof toStoredInsights>;
