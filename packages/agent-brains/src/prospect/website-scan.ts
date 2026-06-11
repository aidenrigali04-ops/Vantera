import { generateObject, type LanguageModel } from "ai";
import { z } from "zod";
import { getModel } from "@vantera/ai";

export const websiteScanSchema = z.object({
  summary: z.string().max(500),
  offerings: z.array(z.string()).max(5),
  value_props: z.array(z.string()).max(5),
  scope_of_industry: z.string().max(200),
});

export type WebsiteScan = z.infer<typeof websiteScanSchema>;

export const SCAN_STALE_AFTER_DAYS = 30;
const MAX_PAGE_CHARS = 8000;

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

const SCAN_SYSTEM = `You analyze a company's homepage text and extract what they sell. Output: summary (what the company does, for whom), offerings (concrete products/services), value_props (the outcomes they promise), scope_of_industry (the industry segments this business serves and operates in). Ground everything in the page text; never invent.`;

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
  return object;
}
