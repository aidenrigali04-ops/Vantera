import { generateObject, type LanguageModel } from "ai";
import { z } from "zod";
import { getClassifierModel, registerPrompt } from "@vantera/ai";

// Permissive schema (validate loose, normalize strict in code — same pattern as rank/classify).
export const watchlistSchema = z.object({
  keywords: z.array(z.string()).default([]),
  hashtags: z.array(z.string()).default([]),
  competitors: z.array(z.string()).default([]),
});
export type IntentWatchlist = z.infer<typeof watchlistSchema>;

export interface WatchlistContext {
  /** accounts.onboarding_industry */
  industry?: string | null;
  /** what the seller offers — website-scan summary + offerings + value props */
  offering?: string | null;
  /** website-scan offerings, already split into phrases */
  offerings?: string[] | null;
  /** accounts.value_prop, or the scan's lead value prop */
  valueProp?: string | null;
  /** accounts.brand_voice — tone for the model, not a watch topic */
  brand?: string | null;
  /** the ICP(s) this account targets, human-readable */
  icp?: string | null;
  /** individual ICP names, when more than one is known */
  icpNames?: string[] | null;
}

const MAX = { keywords: 8, hashtags: 6, competitors: 6 } as const;
const FIELD_MAX = 80;

// Stable system prompt so Anthropic prompt caching hits; per-account context rides in the user message.
const WATCHLIST_SYSTEM = registerPrompt("intent/watchlist", `You set up a LinkedIn buying-intent radar for a B2B seller. Given the seller's business, produce the watch targets that surface people showing they're in-market for THIS seller's offer — so the seller never has to go hunt for profiles or URLs.

Return three lists, each specific to this seller (never generic):
- keywords: 4-8 short phrases people post or comment when they have the problem this seller solves or are shopping for it — pains and buying signals ("looking for a tool to …", "switching from …", "anyone recommend …", "frustrated with …"). Plain phrases; no quotes, no hashtags.
- hashtags: 3-6 LinkedIn hashtags where this seller's buyers and their problem space live. No leading "#".
- competitors: 3-6 company NAMES whose customers would plausibly switch to this seller (direct competitors or the tools they'd replace). Names only — never URLs.

Ground every entry in the seller's actual offering and industry. If you can't ground a competitor, return fewer rather than invent one.`);

function contextBlock(ctx: WatchlistContext): string {
  const offerings = (ctx.offerings ?? []).filter(Boolean).join(", ");
  return [
    `Seller industry: ${ctx.industry ?? "unknown"}`,
    `Seller offer: ${ctx.offering ?? "unknown"}`,
    offerings ? `Offerings: ${offerings}` : "",
    ctx.valueProp ? `Value proposition: ${ctx.valueProp}` : "",
    ctx.brand ? `Brand voice: ${ctx.brand}` : "",
    `Target ICP: ${ctx.icp ?? "unknown"}`,
  ]
    .filter(Boolean)
    .join("\n");
}

const STOP = new Set([
  "the", "a", "an", "and", "or", "of", "for", "to", "in", "on", "with", "your", "our",
  "their", "that", "this", "from", "at", "by", "as", "is", "are", "be", "it", "its",
  "into", "about", "who", "what", "when", "where", "how", "than", "then", "they",
  "them", "you", "we",
]);

function phrase(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const v = raw.replace(/\s+/g, " ").trim().slice(0, FIELD_MAX);
  return v.length >= 3 ? v : null;
}

function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length >= 4 && !STOP.has(word));
}

/**
 * Best watch categories we can name without a model: the seller's own offerings, value
 * proposition, and ICP. Competitors stay empty — a name we weren't given is a guess.
 */
export function watchlistFromContext(ctx: WatchlistContext): IntentWatchlist {
  const offeringPhrases = (ctx.offerings ?? []).map(phrase).filter((v): v is string => Boolean(v));
  const icpPhrases = (ctx.icpNames?.length ? ctx.icpNames : ctx.icp ? [ctx.icp] : [])
    .map(phrase)
    .filter((v): v is string => Boolean(v));
  const keywords = clean(
    [...offeringPhrases, phrase(ctx.valueProp), ...icpPhrases],
    MAX.keywords
  );
  const hashtags = clean(
    tokens([ctx.industry, ...offeringPhrases, ...icpPhrases].filter(Boolean).join(" ")),
    MAX.hashtags
  );
  return { keywords, hashtags, competitors: [] };
}

/** Trim, length-cap, dedupe (case-insensitive), and bound the count; optionally strip a leading "#". */
function clean(list: unknown, max: number, stripHash = false): string[] {
  if (!Array.isArray(list)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of list) {
    if (typeof raw !== "string") continue;
    const v = (stripHash ? raw.trim().replace(/^#+/, "") : raw.trim()).slice(0, FIELD_MAX);
    const key = v.toLowerCase();
    if (v && !seen.has(key)) {
      seen.add(key);
      out.push(v);
    }
    if (out.length >= max) break;
  }
  return out;
}

/**
 * Derive LinkedIn watch targets (keywords, hashtags, competitor names) from what we already know
 * about the seller — so Intent Agent setup needs no hunting for profiles or URLs. Pure + injectable
 * model (rule 13). When the model is unavailable or returns a blank list, the categories fall
 * back to the seller's own website, brand, and ICP words. Competitors are never invented.
 */
export async function deriveIntentWatchlist(
  ctx: WatchlistContext,
  model: LanguageModel = getClassifierModel()
): Promise<IntentWatchlist> {
  const grounded = watchlistFromContext(ctx);
  let raw: IntentWatchlist;
  try {
    raw = (
      await generateObject({
        model,
        schema: watchlistSchema,
        system: WATCHLIST_SYSTEM.text,
        prompt: contextBlock(ctx),
        maxOutputTokens: 1000,
      })
    ).object;
  } catch {
    return grounded;
  }
  const keywords = clean(raw.keywords, MAX.keywords);
  const hashtags = clean(raw.hashtags, MAX.hashtags, true);
  const competitors = clean(raw.competitors, MAX.competitors);
  return {
    keywords: keywords.length ? keywords : grounded.keywords,
    hashtags: hashtags.length ? hashtags : grounded.hashtags,
    competitors,
  };
}
