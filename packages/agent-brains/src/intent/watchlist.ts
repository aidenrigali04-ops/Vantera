import { generateObject, type LanguageModel } from "ai";
import { z } from "zod";
import { getModel } from "@vantera/ai";

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
  /** the ICP(s) this account targets, human-readable */
  icp?: string | null;
}

const MAX = { keywords: 8, hashtags: 6, competitors: 6 } as const;
const FIELD_MAX = 80;

// Stable system prompt so Anthropic prompt caching hits; per-account context rides in the user message.
const WATCHLIST_SYSTEM = `You set up a LinkedIn buying-intent radar for a B2B seller. Given the seller's business, produce the watch targets that surface people showing they're in-market for THIS seller's offer — so the seller never has to go hunt for profiles or URLs.

Return three lists, each specific to this seller (never generic):
- keywords: 4-8 short phrases people post or comment when they have the problem this seller solves or are shopping for it — pains and buying signals ("looking for a tool to …", "switching from …", "anyone recommend …", "frustrated with …"). Plain phrases; no quotes, no hashtags.
- hashtags: 3-6 LinkedIn hashtags where this seller's buyers and their problem space live. No leading "#".
- competitors: 3-6 company NAMES whose customers would plausibly switch to this seller (direct competitors or the tools they'd replace). Names only — never URLs.

Ground every entry in the seller's actual offering and industry. If you can't ground a competitor, return fewer rather than invent one.`;

function contextBlock(ctx: WatchlistContext): string {
  return [
    `Seller industry: ${ctx.industry ?? "unknown"}`,
    `Seller offer: ${ctx.offering ?? "unknown"}`,
    `Target ICP: ${ctx.icp ?? "unknown"}`,
  ].join("\n");
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
 * model (rule 13); fails open to empty lists so a model hiccup never blocks the wizard.
 */
export async function deriveIntentWatchlist(
  ctx: WatchlistContext,
  model: LanguageModel = getModel()
): Promise<IntentWatchlist> {
  let raw: IntentWatchlist;
  try {
    raw = (
      await generateObject({
        model,
        schema: watchlistSchema,
        system: WATCHLIST_SYSTEM,
        prompt: contextBlock(ctx),
        maxOutputTokens: 1000,
      })
    ).object;
  } catch {
    return { keywords: [], hashtags: [], competitors: [] };
  }
  return {
    keywords: clean(raw.keywords, MAX.keywords),
    hashtags: clean(raw.hashtags, MAX.hashtags, true),
    competitors: clean(raw.competitors, MAX.competitors),
  };
}
