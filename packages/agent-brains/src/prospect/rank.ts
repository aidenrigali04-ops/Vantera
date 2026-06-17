import { generateObject, type LanguageModel } from "ai";
import { getModel } from "@vantera/ai";
import type { ProspectSignal } from "@vantera/prospect-data";
import { normalizeInsights, rankBatchSchema, type LeadInsights } from "./schema";

/** Leads per model call: enough to amortize the context, small enough for output-token headroom. */
export const RANK_BATCH_SIZE = 12;
const MAX_OUTPUT_TOKENS = 6000;
const FIELD_MAX = 60;

export interface RankCandidate {
  leadId: string;
  companyName?: string;
  companySize?: string;
  industry?: string;
  location?: string;
  title?: string;
  technographics?: string[];
  signals?: ProspectSignal[];
}

export interface RankContext {
  /** the customer's own industry (accounts.onboarding_industry) */
  accountIndustry?: string | null;
  /** what the customer sells — website-scan summary + value props */
  valueProp?: string | null;
  /** the ICP(s) this run targets, as human-readable text */
  icpDescription?: string | null;
}

const trunc = (s: string | undefined, max = FIELD_MAX) =>
  s ? (s.length > max ? `${s.slice(0, max - 1)}…` : s) : "-";

/** A timing signal older than ~6 months is stale — no longer an "active" trigger (report #9). */
export const SIGNAL_FRESH_DAYS = 180;

const signalAt = (s: ProspectSignal): number => (s.observedAt ? new Date(s.observedAt).getTime() : 0);

/**
 * Decay: drop timing signals past the freshness window and sort newest-first, so the rank brain
 * weighs a recent trigger over a stale one and never treats a 2022 event as happening "now".
 * Unknown-age signals are kept (can't decay what we can't date) and sort last.
 */
export function freshSignals(signals: ProspectSignal[], now: Date = new Date()): ProspectSignal[] {
  return signals
    .filter((s) => {
      if (!s.observedAt) return true;
      const ageDays = (now.getTime() - signalAt(s)) / 86_400_000;
      return !Number.isFinite(ageDays) || ageDays <= SIGNAL_FRESH_DAYS;
    })
    .sort((a, b) => signalAt(b) - signalAt(a));
}

function signalAgeLabel(observedAt: string, now: Date): string | null {
  const days = Math.floor((now.getTime() - new Date(observedAt).getTime()) / 86_400_000);
  if (!Number.isFinite(days) || days < 0) return null;
  return days < 60 ? `${days}d ago` : `${Math.round(days / 30)}mo ago`;
}

/** One pipe-delimited line per lead — compact, stable field order, lossy by design. */
export function compactLead(c: RankCandidate, now: Date = new Date()): string {
  const tech = (c.technographics ?? []).slice(0, 3).join(",");
  const signals = freshSignals(c.signals ?? [], now)
    .slice(0, 3)
    .map((s) => {
      const age = s.observedAt ? signalAgeLabel(s.observedAt, now) : null;
      return `${s.kind}:${trunc(s.detail, 40)}${age ? ` (${age})` : ""}`;
    })
    .join(",");
  return [
    c.leadId,
    trunc(c.companyName),
    trunc(c.companySize, 12),
    trunc(c.industry),
    trunc(c.location, 30),
    trunc(c.title),
    tech || "-",
    signals || "-",
  ].join("|");
}

// Stable system prompt (rubric + output contract) — identical across batches and runs
// so Anthropic prompt caching hits; per-batch content goes in the user message only.
const RANK_SYSTEM = `You are the prospect-quality brain of an SDR platform. You receive a seller context block and a batch of lead lines (format: id|company|size|industry|geo|title|tech|signals). Score how strongly each lead fits the seller's ICP right now.

Rubric:
- 85-100: precise ICP fit AND an active timing signal (hiring, funding, tech change, intent).
- 70-84: precise ICP fit, no strong timing signal — still worth outreach.
- 40-69: partial fit or unclear persona; do not flatter these upward.
- 0-39: weak fit. Be ruthless; most leads are not good leads.

For each lead emit: lead_id (copy the id exactly), reasoning (one dense sentence weighing fit vs timing — think here before scoring), score, rationale (one plain-English line a sales rep reads on a dashboard), pain_points/triggers/motivations (max 3 each, specific to THIS lead, never generic), value_angle (how the seller's offer maps to this lead), aha_moment (the single concrete outcome that would make this prospect lean in), summary (2-3 sentences a rep reads before writing to this person).

Ground every field in the data given. If signals are absent, say so in reasoning and score accordingly — never invent facts.`;

function contextBlock(ctx: RankContext): string {
  return [
    `Seller industry: ${ctx.accountIndustry ?? "unknown"}`,
    `Seller offer: ${ctx.valueProp ?? "unknown"}`,
    `Target ICP: ${ctx.icpDescription ?? "unknown"}`,
  ].join("\n");
}

async function rankBatch(
  batch: RankCandidate[],
  ctx: RankContext,
  model: LanguageModel
): Promise<LeadInsights[]> {
  const prompt = `${contextBlock(ctx)}\n\nLeads:\n${batch.map((c) => compactLead(c)).join("\n")}`;
  const run = () =>
    generateObject({
      model,
      schema: rankBatchSchema,
      system: RANK_SYSTEM,
      prompt,
      maxOutputTokens: MAX_OUTPUT_TOKENS,
    });

  let leads: LeadInsights[];
  try {
    leads = (await run()).object.leads;
  } catch {
    // one retry on schema/generation failure, then let the error surface
    leads = (await run()).object.leads;
  }

  // only keep rows that map back to a real lead in this batch, then enforce the field caps
  // the (now permissive) schema no longer hard-validates
  const known = new Set(batch.map((c) => c.leadId));
  return leads.filter((l) => known.has(l.lead_id)).map(normalizeInsights);
}

/** Stage 2 of the scoring gate (rule 06): batched AI rank over rules-gate survivors. */
export async function rankLeads(
  candidates: RankCandidate[],
  ctx: RankContext,
  model: LanguageModel = getModel()
): Promise<LeadInsights[]> {
  const results: LeadInsights[] = [];
  for (let i = 0; i < candidates.length; i += RANK_BATCH_SIZE) {
    results.push(...(await rankBatch(candidates.slice(i, i + RANK_BATCH_SIZE), ctx, model)));
  }
  return results;
}
