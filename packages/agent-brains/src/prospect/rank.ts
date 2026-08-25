import { generateObject, type LanguageModel } from "ai";
import { getModel, registerPrompt } from "@vantera/ai";
import type { ProspectSignal } from "@vantera/prospect-data";
import { normalizeInsights, rankBatchSchema, type LeadInsights } from "./schema";
import { stripLoneSurrogates } from "../text";

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
  // Signal detail carries the prospect's own words (intent-post text, what they asked for) — the
  // primary evidence for prospect_offering. A 40-char cap sliced that context off and drove the
  // business misread; 120 keeps the substance while staying compact (2026-07-10).
  const signals = freshSignals(c.signals ?? [], now)
    .slice(0, 3)
    .map((s) => {
      const age = s.observedAt ? signalAgeLabel(s.observedAt, now) : null;
      return `${s.kind}:${trunc(s.detail, 120)}${age ? ` (${age})` : ""}`;
    })
    .join(",");
  return [
    c.leadId,
    trunc(c.companyName),
    trunc(c.companySize, 12),
    trunc(c.industry),
    trunc(c.location, 30),
    // Title is the prospect's headline — where their real positioning lives ("...get 10-20 inbound
    // leads, no cold DMs"). 60 chars truncated it mid-claim; 160 preserves the whole headline.
    trunc(c.title, 160),
    tech || "-",
    signals || "-",
  ].join("|");
}

// Stable system prompt (rubric + output contract) — identical across batches and runs
// so Anthropic prompt caching hits; per-batch content goes in the user message only.
const RANK_SYSTEM = registerPrompt("prospect/rank", `You are the prospect-quality brain of an SDR platform. You receive a seller context block and a batch of lead lines (format: id|company|size|industry|geo|title|tech|signals). Score how strongly each lead fits the seller's ICP right now.

Rubric:
- 85-100: precise ICP fit AND an active timing signal (hiring, funding, tech change, intent).
- 70-84: precise ICP fit, no strong timing signal — still worth outreach.
- 40-69: partial fit or unclear persona; do not flatter these upward.
- 0-39: weak fit. Be ruthless; most leads are not good leads.

A \`signals\` entry of kind \`intent\` is the strongest "why now": it means THIS person is actively showing they have the problem the seller solves (asking for a tool, describing the pain) — weight it above generic company events. A lead with a recent, explicit intent signal AND a role/company that plausibly fits the ICP belongs at the top of the range, even when size/industry are blank (normal for an intent-sourced lead — do not mark it down only for missing firmographics). Intent never overrides a clear ICP mismatch: a wrong-persona or wrong-space lead is still weak, intent or not.

For each lead emit: lead_id (copy the id exactly), reasoning (one dense sentence weighing fit vs timing — think here before scoring), score, rationale (one plain-English line a sales rep reads on a dashboard), pain_points/triggers/motivations (max 3 each, specific to THIS lead, never generic), prospect_offering, value_angle, aha_moment (the single concrete outcome that would make this prospect lean in), summary (2-3 sentences a rep reads before writing to this person).

prospect_offering — what THIS prospect's own company or role does, in THEIR terms, grounded only in their title/company/signals. This is about them, never about the seller. Preserve their exact numbers and the DIRECTION of what they do: a title that says "I help founders get 10-20 inbound leads" means they PROVIDE that service (their client gets the leads), it does NOT mean "they run lead gen for 10-20 founders" and it is NOT the seller's offer. Never flip inbound vs outbound, buyer vs seller, or who does what for whom. If their title is vague, state only what is certain and no more.

value_angle — how the SELLER's offer could specifically help this prospect. Keep the seller's offer and the prospect's own business DISTINCT: describe the benefit to them without restating their business as if it were the seller's.

Ground every field in the data given. If signals are absent, say so in reasoning and score accordingly — never invent facts. Never alter a prospect's stated numbers or flip the direction of what they do; use their own words. Misrepresenting a prospect's business is a worse error than saying less about it.`);

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
  // strip lone surrogates from any scraped field — they 400 the model API as invalid JSON
  const prompt = stripLoneSurrogates(`${contextBlock(ctx)}\n\nLeads:\n${batch.map((c) => compactLead(c)).join("\n")}`);
  const run = () =>
    generateObject({
      model,
      schema: rankBatchSchema,
      system: RANK_SYSTEM.text,
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

/** Max rank batches in flight at once. Bounded so a large survivor set doesn't burst the model's
 *  rate limit; the stable system prompt still lets concurrent calls share Anthropic's prompt cache. */
const RANK_CONCURRENCY = 3;

/** Stage 2 of the scoring gate (rule 06): batched AI rank over rules-gate survivors. */
export async function rankLeads(
  candidates: RankCandidate[],
  ctx: RankContext,
  model: LanguageModel = getModel()
): Promise<LeadInsights[]> {
  const batches: RankCandidate[][] = [];
  for (let i = 0; i < candidates.length; i += RANK_BATCH_SIZE) {
    batches.push(candidates.slice(i, i + RANK_BATCH_SIZE));
  }
  // Process batches in bounded-concurrency waves; output order is preserved (wave order, then
  // Promise.all order), so the previous sequential behavior is unchanged apart from latency.
  const results: LeadInsights[] = [];
  for (let i = 0; i < batches.length; i += RANK_CONCURRENCY) {
    const wave = await Promise.all(
      batches.slice(i, i + RANK_CONCURRENCY).map((b) => rankBatch(b, ctx, model))
    );
    for (const r of wave) results.push(...r);
  }
  return results;
}

/** Rationale stamped on a lead the model omitted after retry — pipelines persist this as unqualified. */
export const RANK_MISS_RATIONALE = "rank miss";

/** Synthetic insights for a lead the rank model never returned. Score 0 so they never clear min_score. */
export function rankMissInsights(leadId: string): LeadInsights {
  return {
    lead_id: leadId,
    reasoning: RANK_MISS_RATIONALE,
    score: 0,
    rationale: RANK_MISS_RATIONALE,
    pain_points: [],
    triggers: [],
    motivations: [],
    prospect_offering: "",
    value_angle: "",
    aha_moment: "",
    summary: "",
  };
}

/**
 * Every candidate gets exactly one insights row: the model's if present, otherwise a rank-miss.
 * First-seen insight per lead_id wins (retry rows that duplicate an id are ignored).
 */
export function completeRankResults(candidates: RankCandidate[], insights: LeadInsights[]): LeadInsights[] {
  const byId = new Map<string, LeadInsights>();
  for (const i of insights) {
    if (!byId.has(i.lead_id)) byId.set(i.lead_id, i);
  }
  return candidates.map((c) => byId.get(c.leadId) ?? rankMissInsights(c.leadId));
}
