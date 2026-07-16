import { generateObject, type LanguageModel } from "ai";
import { z } from "zod";
import { getModel, registerPrompt } from "@vantera/ai";
import { assertPublicHttpUrl, createGuardedFetch } from "./url-guard";

// Shape only — NO hard length/count caps here. Anthropic structured output treats
// JSON-schema maxItems/maxLength as soft hints, so a content-rich homepage routinely
// yields 10-16 offerings; a `.max()` here makes generateObject reject every real scan
// post-generation (AI_NoObjectGeneratedError). Limits are requested in the prompt and
// enforced defensively in scanWebsite() instead, so good output is never thrown away.
export const websiteScanSchema = z.object({
  // One glanceable line for the onboarding confirmation — "got it on first look".
  headline: z.string(),
  summary: z.string(),
  offerings: z.array(z.string()),
  value_props: z.array(z.string()),
  scope_of_industry: z.string(),
  // The single best-fit buyer to prospect for them — pre-fills the onboarding target audience.
  suggested_icp: z.string(),
});

export type WebsiteScan = z.infer<typeof websiteScanSchema>;

export const SCAN_STALE_AFTER_DAYS = 30;
const MAX_PAGE_CHARS = 8000;
const MAX_LIST_ITEMS = 5;
const MAX_HEADLINE_CHARS = 140;
const MAX_SUMMARY_CHARS = 500;
const MAX_SCOPE_CHARS = 200;
const MAX_ICP_CHARS = 140;
const FETCH_TIMEOUT_MS = 10_000;
const MAX_FETCH_BYTES = 5_000_000; // hard cap on the response body we'll read into memory

/** Read a response body up to maxBytes, truncating (not erroring) past the cap. */
async function readCapped(res: Response, maxBytes: number): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return (await res.text()).slice(0, maxBytes);
  const decoder = new TextDecoder();
  let out = "";
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    out += decoder.decode(value, { stream: true });
    if (total > maxBytes) {
      await reader.cancel();
      break;
    }
  }
  return out;
}

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

const SCAN_SYSTEM = registerPrompt("prospect/website-scan", `You analyze a company's homepage text and extract what they sell. Output:
- headline: ONE plain, glanceable sentence the owner will instantly recognize — who they are, what they sell, and to whom. Under 16 words, no marketing fluff. e.g. "You sell AI onboarding software to RevOps teams at B2B SaaS companies."
- summary: what the company does, for whom — 1-2 sentences.
- offerings: the most important concrete products/services, up to 5.
- value_props: the most important outcomes they promise, up to 5.
- scope_of_industry: the industry segments this business serves and operates in.
- suggested_icp: the single best-fit buyer this company should prospect — a crisp persona of role + company type, one phrase. e.g. "VP of Sales at mid-market logistics companies".
Ground everything in the page text; never invent.`);

/** Scan the customer's website so the Scout brain knows what the seller offers (config: "scope of industry"). */
export async function scanWebsite(
  url: string,
  options: {
    model?: LanguageModel;
    fetchImpl?: typeof fetch;
    /** SSRF pre-validation; defaults to the real DNS-resolving guard. Injectable for tests. */
    validate?: (url: string) => Promise<unknown>;
  } = {}
): Promise<WebsiteScan> {
  // SSRF guard (rule: never fetch a user-supplied URL unguarded). Pre-validate the target,
  // then fetch through a transport that re-checks the connecting IP at socket time so
  // redirects / DNS-rebinding to internal hosts are also blocked.
  const validate = options.validate ?? assertPublicHttpUrl;
  const fetchImpl = options.fetchImpl ?? createGuardedFetch();
  await validate(url);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetchImpl(url, { headers: { accept: "text/html" }, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) {
    throw new Error(`website fetch failed (${res.status})`);
  }
  const text = htmlToText(await readCapped(res, MAX_FETCH_BYTES)).slice(0, MAX_PAGE_CHARS);
  if (!text) {
    throw new Error("website returned no readable text");
  }
  const { object } = await generateObject({
    model: options.model ?? getModel(),
    schema: websiteScanSchema,
    system: SCAN_SYSTEM.text,
    prompt: `Homepage text of ${url}:\n\n${text}`,
    maxOutputTokens: 1200,
  });
  // Enforce product limits here (not in the schema) so a thorough scan is clamped,
  // never rejected — keeps the summary screen tidy and the cached scan bounded.
  return {
    headline: object.headline.slice(0, MAX_HEADLINE_CHARS),
    summary: object.summary.slice(0, MAX_SUMMARY_CHARS),
    offerings: object.offerings.slice(0, MAX_LIST_ITEMS),
    value_props: object.value_props.slice(0, MAX_LIST_ITEMS),
    scope_of_industry: object.scope_of_industry.slice(0, MAX_SCOPE_CHARS),
    suggested_icp: object.suggested_icp.slice(0, MAX_ICP_CHARS),
  };
}
