import { generateObject, type LanguageModel } from "ai";
import { z } from "zod";
import { getModel } from "@vantera/ai";

// Shape only — NO hard length/count caps here. Anthropic structured output treats
// JSON-schema maxItems/maxLength as soft hints, so a content-rich homepage routinely
// yields 10-16 offerings; a `.max()` here makes generateObject reject every real scan
// post-generation (AI_NoObjectGeneratedError). Limits are requested in the prompt and
// enforced defensively in scanWebsite() instead, so good output is never thrown away.
export const websiteScanSchema = z.object({
  summary: z.string(),
  offerings: z.array(z.string()),
  value_props: z.array(z.string()),
  scope_of_industry: z.string(),
});

export type WebsiteScan = z.infer<typeof websiteScanSchema>;

export const SCAN_STALE_AFTER_DAYS = 30;
const MAX_PAGE_CHARS = 8000;
const MAX_LIST_ITEMS = 5;
const MAX_SUMMARY_CHARS = 500;
const MAX_SCOPE_CHARS = 200;

/** Refresh when never scanned, the URL changed, or the scan is older than 30 days. */
export function isScanStale(
  scannedAt: Date | null,
  scannedUrl: string | null,
  currentUrl: string,
  now: Date = new Date()
): boolean {
  if (!scannedAt || scannedUrl !== currentUrl) return true;
  const ageDays = (now.getTime() - scannedAt.getTime()) / 86_400_000;
  return ageDays > SCAN_STALE_AFTER_DAYS;
}

/** Crude but dependency-free: drop scripts/styles/tags, collapse whitespace. */
export function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z#0-9]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const SCAN_SYSTEM = `You analyze a company's homepage text and extract what they sell. Output: summary (what the company does, for whom — 1-2 sentences), offerings (the most important concrete products/services, up to 5), value_props (the most important outcomes they promise, up to 5), scope_of_industry (the industry segments this business serves and operates in). Ground everything in the page text; never invent.`;

/** Scan the customer's website so the Scout brain knows what the seller offers (config: "scope of industry"). */
export async function scanWebsite(
  url: string,
  options: { model?: LanguageModel; fetchImpl?: typeof fetch } = {}
): Promise<WebsiteScan> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const res = await fetchImpl(url, { headers: { accept: "text/html" } });
  if (!res.ok) {
    throw new Error(`website fetch failed (${res.status})`);
  }
  const text = htmlToText(await res.text()).slice(0, MAX_PAGE_CHARS);
  if (!text) {
    throw new Error("website returned no readable text");
  }
  const { object } = await generateObject({
    model: options.model ?? getModel(),
    schema: websiteScanSchema,
    system: SCAN_SYSTEM,
    prompt: `Homepage text of ${url}:\n\n${text}`,
    maxOutputTokens: 1200,
  });
  // Enforce product limits here (not in the schema) so a thorough scan is clamped,
  // never rejected — keeps the summary screen tidy and the cached scan bounded.
  return {
    summary: object.summary.slice(0, MAX_SUMMARY_CHARS),
    offerings: object.offerings.slice(0, MAX_LIST_ITEMS),
    value_props: object.value_props.slice(0, MAX_LIST_ITEMS),
    scope_of_industry: object.scope_of_industry.slice(0, MAX_SCOPE_CHARS),
  };
}
