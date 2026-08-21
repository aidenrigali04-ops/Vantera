import { generateObject, type LanguageModel } from "ai";
import { z } from "zod";
import { getModel, registerPrompt } from "@vantera/ai";
import type { WebsiteScan } from "./website-scan";

// Permissive schema (validate loose, normalize strict in code — same pattern as watchlist/rank).
export const icpDraftSchema = z.object({
  /** Short human label for the buyer profile, e.g. "Heads of Sales · B2B SaaS". */
  name: z.string().default(""),
  titles: z.array(z.string()).default([]),
  industries: z.array(z.string()).default([]),
  companySizes: z.array(z.string()).default([]),
  geos: z.array(z.string()).default([]),
  signals: z.array(z.string()).default([]),
});
export type IcpDraft = z.infer<typeof icpDraftSchema>;

export interface IcpDraftContext {
  /** The seller's brand / workspace name. */
  companyName?: string | null;
  /** What we learned from their homepage (scanWebsite). */
  scan: Pick<WebsiteScan, "summary" | "offerings" | "value_props" | "scope_of_industry">;
}

/** Headcount buckets the discovery filter understands — anything else is dropped. */
export const ICP_SIZE_BUCKETS = ["1-10", "11-50", "51-200", "200+"] as const;

const MAX = { titles: 6, industries: 4, companySizes: 4, geos: 3, signals: 5 } as const;
const FIELD_MAX = 60;
const NAME_MAX = 80;

// Stable system prompt so prompt caching hits; per-account context rides in the user message.
// Registered (WS-2.1) so the prompt registry can version and audit it like every other brain.
const ICP_DRAFT_PROMPT = registerPrompt("prospect/icp-draft", `You are a B2B sales strategist drafting the ideal customer profile for a seller, from nothing but what their website says. The profile feeds a deterministic targeting filter, so every entry must be concrete and searchable on LinkedIn — never a vague persona.

Return:
- name: a 2-6 word label for the buyer, "<role family> · <market>" (e.g. "Heads of Sales · B2B SaaS").
- titles: 3-6 job titles of the person who BUYS this offer (the budget owner or the person whose problem it solves). Real titles as they appear on LinkedIn ("VP of Sales", "Head of Growth", "Founder"), no seniority adjectives, no slashes.
- industries: 2-4 industries the buyer's company is in. Use common LinkedIn industry names ("Software Development", "Marketing Services", "Financial Services").
- companySizes: 1-4 headcount buckets from exactly this set: "1-10", "11-50", "51-200", "200+".
- geos: 0-3 countries or regions if the site clearly targets one; otherwise an empty list.
- signals: 2-5 short buying signals that make a company in-market for THIS offer ("hiring SDRs", "just raised a seed round", "switching CRMs").

Ground every entry in the seller's actual offer. Prefer fewer, sharper entries over generic coverage. If the site is too thin to decide something, return an empty list for that field rather than guessing.`);

function contextBlock(ctx: IcpDraftContext): string {
  const s = ctx.scan;
  return [
    `Seller: ${ctx.companyName?.trim() || "unknown"}`,
    `Summary: ${s.summary || "unknown"}`,
    `Offerings: ${s.offerings?.length ? s.offerings.join("; ") : "unknown"}`,
    `Value props: ${s.value_props?.length ? s.value_props.join("; ") : "unknown"}`,
    `Industry scope: ${s.scope_of_industry || "unknown"}`,
  ].join("\n");
}

/** Trim, length-cap, dedupe (case-insensitive), bound the count. */
function clean(list: unknown, max: number): string[] {
  if (!Array.isArray(list)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of list) {
    if (typeof raw !== "string") continue;
    const v = raw.trim().slice(0, FIELD_MAX);
    const key = v.toLowerCase();
    if (v && !seen.has(key)) {
      seen.add(key);
      out.push(v);
    }
    if (out.length >= max) break;
  }
  return out;
}

/** Keep only the buckets the discovery filter understands (model output can drift: "50-200", "1–10"). */
function cleanSizes(list: unknown): string[] {
  const allowed = new Set<string>(ICP_SIZE_BUCKETS);
  const normalized = Array.isArray(list)
    ? list
        .filter((s): s is string => typeof s === "string")
        .map((s) => s.replace(/\s+/g, "").replace(/[–—]/g, "-"))
        .filter((s) => allowed.has(s))
    : [];
  // filter BEFORE capping so an invalid bucket never crowds out a valid one
  return clean(normalized, MAX.companySizes);
}

export const EMPTY_ICP_DRAFT: IcpDraft = {
  name: "",
  titles: [],
  industries: [],
  companySizes: [],
  geos: [],
  signals: [],
};

/**
 * Draft the onboarding ICP from the website scan — so onboarding never asks "who do you
 * sell to?". Pure + injectable model (rule 13); fails open to the EMPTY draft so a model
 * hiccup never blocks onboarding (the caller writes `{}` criteria and the user refines in
 * Settings). The `name` falls back to "<first title> · <first industry>" when the model
 * leaves it blank, and to "Ideal buyers" when there is nothing to name.
 */
export async function draftIcp(
  ctx: IcpDraftContext,
  model: LanguageModel = getModel()
): Promise<IcpDraft> {
  let raw: IcpDraft;
  try {
    raw = (
      await generateObject({
        model,
        schema: icpDraftSchema,
        system: ICP_DRAFT_PROMPT.text,
        prompt: contextBlock(ctx),
        maxOutputTokens: 800,
      })
    ).object;
  } catch {
    return EMPTY_ICP_DRAFT;
  }
  const titles = clean(raw.titles, MAX.titles);
  const industries = clean(raw.industries, MAX.industries);
  const fallbackName = [titles[0], industries[0]].filter(Boolean).join(" · ");
  return {
    name: (raw.name ?? "").trim().slice(0, NAME_MAX) || fallbackName || "Ideal buyers",
    titles,
    industries,
    companySizes: cleanSizes(raw.companySizes),
    geos: clean(raw.geos, MAX.geos),
    signals: clean(raw.signals, MAX.signals),
  };
}

/** True when the draft carries anything the rules gate or rank can use. */
export function icpDraftIsEmpty(d: IcpDraft): boolean {
  return (
    d.titles.length === 0 &&
    d.industries.length === 0 &&
    d.companySizes.length === 0 &&
    d.geos.length === 0 &&
    d.signals.length === 0
  );
}
