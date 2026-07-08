import { generateObject, type LanguageModel } from "ai";
import { z } from "zod";
import { getModel } from "@vantera/ai";
import type { IcpCriteria } from "@vantera/prospect-data";
import { stripLoneSurrogates } from "../text";

/**
 * ICP free text → structured discovery criteria (titles / industries / geos / sizes).
 *
 * The onboarding wizard stores the ICP as one free-text line (icps.name) with an EMPTY
 * criteria object — but discovery searches on criteria, so an underived ICP searches with
 * an empty input and silently finds nothing (the 2026-07-08 "scout never discovered a
 * single lead" incident). The scout derives criteria from the text once and persists them.
 *
 * Permissive schema + strict normalization, same contract as the rank brain: the model
 * can't reliably honor caps, so validation stays loose and `normalizeCriteria` enforces.
 */
const derivedCriteriaSchema = z.object({
  reasoning: z.string(),
  titles: z.array(z.string()),
  seniorities: z.array(z.string()),
  industries: z.array(z.string()),
  geos: z.array(z.string()),
  companySizes: z.array(z.string()),
});

export interface DeriveCriteriaContext {
  /** the customer's own industry (accounts.onboarding_industry) */
  accountIndustry?: string | null;
  /** what the customer sells — website-scan summary */
  valueProp?: string | null;
}

const MAX_PER_FIELD = 10;
const MAX_OUTPUT_TOKENS = 1200;

// Stable system prompt (identical across runs → Anthropic prompt caching hits).
const DERIVE_SYSTEM = `You turn a seller's free-text ideal-customer description into LinkedIn people-search filters. You receive a seller context block and the ICP description; emit reasoning first (one dense sentence deciding who the human buyer is), then the filter arrays.

Rules per field:
- titles: the job titles of the HUMAN BUYER, as they appear on LinkedIn profiles. If the description names roles, use them plus their close variants (e.g. "Head of Sales" also "VP Sales", "Sales Director"). If it only describes a company type, infer the 2-4 most likely decision-maker titles for what this seller offers (a product for small SaaS teams → "Founder", "CEO", "Co-Founder"). titles must NEVER be empty — a people search cannot run without them.
- seniorities: always emit an empty array; fold any seniority language ("executives", "leadership") into concrete titles instead.
- industries: 1-4 short industry keywords used as a search query (e.g. "SaaS", "construction", "real estate development"). Prefer the prospect's industry from the description; never the seller's own industry unless they sell into it.
- geos: locations exactly as LinkedIn names them ("United States", "Qatar", "Saudi Arabia"). Expand a named region into its countries when it has few (GCC → Qatar, Saudi Arabia, United Arab Emirates, Kuwait, Bahrain, Oman). Empty when the description states no geography — never invent one.
- companySizes: LinkedIn headcount ranges, only when size is stated or clearly implied: "1-10","11-50","51-200","201-500","501-1000","1001-5000","5001-10000","10001+" ("small team" → "1-10","11-50"). Empty otherwise.

Ground everything in the description and seller context. Emit only filters the description states or strongly implies — a wrong filter silently hides real buyers.`;

function cleanList(values: string[]): string[] | undefined {
  const out = [...new Set(values.map((v) => v.trim()).filter(Boolean))].slice(0, MAX_PER_FIELD);
  return out.length > 0 ? out : undefined;
}

/** Loose model output → the persisted IcpCriteria shape (only non-empty fields). */
export function normalizeCriteria(raw: {
  titles: string[];
  seniorities: string[];
  industries: string[];
  geos: string[];
  companySizes: string[];
}): IcpCriteria {
  const criteria: IcpCriteria = {};
  const titles = cleanList(raw.titles);
  if (titles) criteria.titles = titles;
  // The rules gate ANDs titles and seniorities against the same candidate title, so a
  // seniority word that isn't a substring of a matching title would reject every lead —
  // seniorities only survive when there are no titles to carry the check.
  const seniorities = cleanList(raw.seniorities);
  if (seniorities && !titles) criteria.seniorities = seniorities;
  const industries = cleanList(raw.industries);
  if (industries) criteria.industries = industries;
  const geos = cleanList(raw.geos);
  if (geos) criteria.geos = geos;
  const companySizes = cleanList(raw.companySizes);
  if (companySizes) criteria.companySizes = companySizes;
  return criteria;
}

/** Derive structured discovery criteria from an ICP's free-text description. */
export async function deriveIcpCriteria(
  icpText: string,
  ctx: DeriveCriteriaContext = {},
  model: LanguageModel = getModel()
): Promise<IcpCriteria> {
  const prompt = stripLoneSurrogates(
    [
      `Seller industry: ${ctx.accountIndustry ?? "unknown"}`,
      `Seller offer: ${ctx.valueProp ?? "unknown"}`,
      `ICP description: ${icpText}`,
    ].join("\n")
  );
  const run = () =>
    generateObject({
      model,
      schema: derivedCriteriaSchema,
      system: DERIVE_SYSTEM,
      prompt,
      maxOutputTokens: MAX_OUTPUT_TOKENS,
    });

  let object: z.infer<typeof derivedCriteriaSchema>;
  try {
    object = (await run()).object;
  } catch {
    // one retry on schema/generation failure, then let the error surface
    object = (await run()).object;
  }
  return normalizeCriteria(object);
}
