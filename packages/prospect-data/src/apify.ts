import type {
  CreditBalance,
  EnrichedProspect,
  ProspectCandidate,
  ProspectDataSource,
  ProspectFilters,
  ProspectRef,
} from "./types";

/**
 * Apify-backed discovery (LinkedIn / Sales Navigator search). Apify is an implementation detail
 * behind ProspectDataSource (rule 05) — never user-facing. Discovery was switched off Explorium to
 * Apify (2026-06-22) for a far wider top-of-funnel pull. Apify scrapes on its OWN infra, so the
 * customer's connected LinkedIn account is never spent on discovery (account-safe).
 *
 * Apify-only model: there is no firmographic/email enrichment provider, so `enrichProspects` is a
 * no-op — the quality gate qualifies on the LinkedIn-profile fields plus the rank's plausible-fit
 * scoring (the rank already handles thin, firmographic-less leads). Outreach is LinkedIn, so no
 * email is needed to send.
 *
 * Actor input/output schemas vary by actor. `buildSearchInput` + `toCandidate` cover the common
 * LinkedIn-search conventions and MUST be verified against the specific actor you configure
 * (APIFY_LINKEDIN_ACTOR); set APIFY_ACTOR_INPUT to merge any actor-specific static input. Defensive
 * extraction skips rows missing a profile URL, so a schema mismatch degrades to fewer leads — never
 * a crash.
 */

const DEFAULT_BASE_URL = "https://api.apify.com";

export interface ApifyOptions {
  token?: string;
  /** Apify actor id/name that runs the LinkedIn/Sales-Nav search (e.g. "user/actor"). */
  actorId?: string;
  /** Static input merged into every run — set per-actor via APIFY_ACTOR_INPUT (JSON). */
  extraInput?: Record<string, unknown>;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}

type Item = Record<string, unknown>;

/** First non-empty string among the candidate keys (actors name the same field differently). */
function str(item: Item, ...keys: string[]): string | undefined {
  for (const k of keys) {
    const v = item[k];
    if (typeof v === "string" && v.trim().length > 0) return v.trim();
  }
  return undefined;
}

/**
 * Map the ICP filters onto the actor's input. Wired + verified live against harvestapi/
 * linkedin-profile-search (2026-06-23): structured `currentJobTitles` + `locations` filters, an
 * `searchQuery` for industry/free-text context, `maxItems` cap, and `profileScraperMode: "Short"`
 * (cheapest, ~$4/1k — already returns name, title, company, location). Extra static fields for a
 * different actor ride through APIFY_ACTOR_INPUT.
 */
export function buildSearchInput(filters: ProspectFilters, limit: number): Record<string, unknown> {
  const titles = [...(filters.titles ?? []), ...(filters.seniorities ?? [])];
  const input: Record<string, unknown> = { maxItems: limit, profileScraperMode: "Short" };
  const industryQuery = (filters.industries ?? []).join(" ").trim();
  if (industryQuery) input.searchQuery = industryQuery;
  if (titles.length > 0) input.currentJobTitles = titles;
  if (filters.geos && filters.geos.length > 0) input.locations = filters.geos;
  return input;
}

/** The current (or first) position object — HarvestAPI nests company + title here, not top-level. */
function firstPosition(item: Item): Item | undefined {
  const pos = item.currentPositions ?? item.currentPosition ?? item.positions;
  return Array.isArray(pos) && pos.length > 0 && typeof pos[0] === "object" && pos[0] !== null
    ? (pos[0] as Item)
    : undefined;
}

/** Location is a string on some actors, an object ({ linkedinText }) on HarvestAPI. */
function locationString(item: Item): string | undefined {
  const loc = item.location;
  if (typeof loc === "string" && loc.trim()) return loc.trim();
  if (loc && typeof loc === "object") {
    return str(loc as Item, "linkedinText", "text", "name", "default", "full");
  }
  return str(item, "locationName", "addressWithCountry", "geoRegion");
}

/** One scraped LinkedIn-search row → a discovery candidate (thin: no firmographics). */
export function toCandidate(item: Item): ProspectCandidate | null {
  const profileUrl = str(item, "profileUrl", "linkedinUrl", "url", "publicUrl", "link");
  if (!profileUrl) return null;
  const pos = firstPosition(item);
  const first = str(item, "firstName", "first_name");
  const last = str(item, "lastName", "last_name");
  const full = str(item, "fullName", "name") ?? ([first, last].filter(Boolean).join(" ") || undefined);
  const parts = (full ?? "").split(/\s+/).filter(Boolean);
  return {
    externalRef: profileUrl,
    companyName:
      str(item, "companyName", "company", "currentCompany", "organization") ??
      (pos ? str(pos, "companyName", "company") : undefined) ??
      "",
    companyDomain: str(item, "companyWebsite", "companyDomain"),
    location: locationString(item),
    firstName: first ?? parts[0],
    lastName: last ?? (parts.length > 1 ? parts.slice(1).join(" ") : undefined),
    title:
      str(item, "headline", "title", "occupation", "jobTitle", "position") ??
      (pos ? str(pos, "title", "role") : undefined),
    linkedinUrl: profileUrl,
  };
}

export class ApifyProspectData implements ProspectDataSource {
  private readonly token: string;
  private readonly actorId: string;
  private readonly extraInput: Record<string, unknown>;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: ApifyOptions = {}) {
    const token = options.token ?? process.env.APIFY_TOKEN;
    const actorId = options.actorId ?? process.env.APIFY_LINKEDIN_ACTOR;
    if (!token) throw new Error("APIFY_TOKEN is not set");
    if (!actorId) throw new Error("APIFY_LINKEDIN_ACTOR is not set");
    this.token = token;
    this.actorId = actorId;
    this.extraInput = options.extraInput ?? safeJson(process.env.APIFY_ACTOR_INPUT);
    this.baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async discoverProspects(filters: ProspectFilters, limit: number): Promise<ProspectCandidate[]> {
    // run-sync-get-dataset-items: start the actor, wait for it, and return the scraped dataset items
    // in one call. Actor ids are written "user/actor" but the run endpoint wants the "~" form.
    const actor = this.actorId.replace("/", "~");
    const res = await this.fetchImpl(`${this.baseUrl}/v2/acts/${actor}/run-sync-get-dataset-items`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${this.token}` },
      body: JSON.stringify({ ...buildSearchInput(filters, limit), ...this.extraInput }),
    });
    if (!res.ok) throw new Error(`prospect discovery failed (${res.status})`);
    const json = (await res.json()) as unknown;
    // run-sync-get-dataset-items returns the items array directly; tolerate {items}/{data} wrappers.
    const items: Item[] = Array.isArray(json)
      ? (json as Item[])
      : Array.isArray((json as { items?: unknown }).items)
        ? (json as { items: Item[] }).items
        : Array.isArray((json as { data?: unknown }).data)
          ? (json as { data: Item[] }).data
          : [];

    const seen = new Set<string>();
    const out: ProspectCandidate[] = [];
    for (const item of items) {
      const c = toCandidate(item);
      if (c && !seen.has(c.externalRef)) {
        seen.add(c.externalRef);
        out.push(c);
      }
    }
    return out.slice(0, limit);
  }

  async enrichProspects(_refs: ProspectRef[]): Promise<EnrichedProspect[]> {
    // Apify-only: no firmographic/email enrichment provider. Discovery already carries the LinkedIn
    // fields the gate qualifies on, and outreach is LinkedIn (no email needed), so there is nothing
    // to enrich. Returns [] — the scout falls back to each candidate's own discovery fields.
    return [];
  }

  async getCreditBalance(): Promise<CreditBalance | null> {
    // Apify bills compute units per run, not per-lead credits, so the scout's per-prospect COGS
    // guard doesn't map. Return null → the caller treats it as "unknown" and fails open (a balance
    // read never halts prospecting).
    return null;
  }
}

function safeJson(raw: string | undefined): Record<string, unknown> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}
