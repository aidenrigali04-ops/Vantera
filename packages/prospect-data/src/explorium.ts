import type {
  EnrichedProspect,
  ProspectCandidate,
  ProspectDataSource,
  ProspectFilters,
  ProspectSignal,
} from "./types";

// Endpoint paths and filter keys live here only; verify against the AgentSource API
// reference when wiring live (the adapter contract is covered by tests with a fetch stub).
const BASE_URL = "https://api.explorium.ai/v1";
const DISCOVER_PATH = "/prospects";
const ENRICH_PATH = "/prospects/contacts_information/bulk_enrich";

export interface ExploriumOptions {
  apiKey?: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}

type FilterValues = { values: string[] };

// AgentSource /v1/prospects is a strict (Pydantic) schema: unknown filter keys and bad enum
// values both 422. Keys + enums below are verified against the live API. Three direct-use
// filters are supported for our ICP shape; industries/techStack/signals are intentionally NOT
// sent — there is no free-text industry filter (linkedin_category needs a strict taxonomy that
// raw ICP strings would 422 on; google_category silently returns 0). Industry/tech are filtered
// by the deterministic rules gate (rule 06) on returned candidates; signals ride enrichment.

const SIZE_BUCKETS = ["1-10", "11-50", "51-200", "201-500", "501-1000", "1001-5000", "5001-10000", "10001+"] as const;

/** Free-form ICP size ("11-50", "11,50", "200") → nearest Explorium company_size bucket. */
function mapCompanySize(value: string): string | undefined {
  const v = value.trim().toLowerCase().replace(/employees?/g, "").replace(/\s/g, "");
  const direct = SIZE_BUCKETS.find((b) => b === v);
  if (direct) return direct;
  const min = Number(v.split(/[,-]/)[0]);
  if (!Number.isFinite(min)) return undefined;
  if (min <= 10) return "1-10";
  if (min <= 50) return "11-50";
  if (min <= 200) return "51-200";
  if (min <= 500) return "201-500";
  if (min <= 1000) return "501-1000";
  if (min <= 5000) return "1001-5000";
  if (min <= 10000) return "5001-10000";
  return "10001+";
}

const COUNTRY_CODES: Record<string, string> = {
  "united states": "US", us: "US", usa: "US", america: "US",
  canada: "CA", ca: "CA",
  "united kingdom": "GB", uk: "GB", gb: "GB", england: "GB",
  australia: "AU", au: "AU",
};

/** ICP geo ("united states", "US") → ISO alpha-2 company_country_code. */
function mapCountry(value: string): string | undefined {
  const v = value.trim().toLowerCase();
  if (COUNTRY_CODES[v]) return COUNTRY_CODES[v];
  if (/^[a-z]{2}$/.test(v)) return v.toUpperCase();
  return undefined;
}

// Verified-valid job_level enum values. titles + seniorities collapse onto these (job_title as a
// filter requires autocomplete IDs, so we use the direct-use job_level instead).
function mapJobLevels(titles: string[], seniorities: string[]): string[] {
  const levels = new Set<string>();
  for (const raw of [...titles, ...seniorities]) {
    const t = raw.toLowerCase();
    if (t.includes("owner")) levels.add("owner");
    if (t.includes("founder")) levels.add("founder");
    if (/ceo|chief|cxo|c-suite|c-level|president/.test(t)) levels.add("c-suite");
    if (t.includes("vp") || t.includes("vice president")) levels.add("vice president");
    if (t.includes("director") || t.includes("head")) levels.add("director");
    if (t.includes("manager") || t.includes("lead")) levels.add("manager");
    if (t.includes("partner")) levels.add("partner");
  }
  return [...levels];
}

function buildFilters(filters: ProspectFilters): Record<string, FilterValues> {
  const out: Record<string, FilterValues> = {};

  const jobLevels = mapJobLevels(filters.titles ?? [], filters.seniorities ?? []);
  // default to decision-makers so a sparse ICP still yields a valid, scoped request
  out.job_level = { values: jobLevels.length > 0 ? jobLevels : ["owner", "c-suite", "founder"] };

  const sizes = [...new Set((filters.companySizes ?? []).map(mapCompanySize).filter((s): s is string => Boolean(s)))];
  if (sizes.length > 0) out.company_size = { values: sizes };

  const countries = [...new Set((filters.geos ?? []).map(mapCountry).filter((c): c is string => Boolean(c)))];
  out.company_country_code = { values: countries.length > 0 ? countries : ["US"] };

  return out;
}

type ProviderRow = Record<string, unknown>;

function str(row: ProviderRow, key: string): string | undefined {
  const v = row[key];
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

function toCandidate(row: ProviderRow): ProspectCandidate {
  return {
    externalRef: str(row, "prospect_id") ?? "",
    companyName: str(row, "company_name") ?? "",
    companyDomain: str(row, "company_website"),
    companySize: str(row, "company_size"),
    industry: str(row, "company_industry"),
    location: str(row, "country_name"),
    firstName: str(row, "first_name"),
    lastName: str(row, "last_name"),
    title: str(row, "job_title"),
    linkedinUrl: str(row, "linkedin"),
  };
}

function toEnriched(row: ProviderRow): EnrichedProspect {
  const emails = Array.isArray(row.emails) ? (row.emails as ProviderRow[]) : [];
  const phones = Array.isArray(row.phone_numbers) ? (row.phone_numbers as ProviderRow[]) : [];
  const events = Array.isArray(row.events) ? (row.events as ProviderRow[]) : [];
  const email = emails[0];
  const phone = phones[0];
  const signals: ProspectSignal[] = events.map((e) => ({
    kind: str(e, "event_name") ?? "event",
    detail: str(e, "event_description") ?? "",
    observedAt: str(e, "event_time"),
  }));
  return {
    ...toCandidate(row),
    email: email ? str(email, "email") : undefined,
    emailStatus: email ? (str(email, "status") as EnrichedProspect["emailStatus"]) : undefined,
    phone: phone ? str(phone, "phone_number") : undefined,
    phoneStatus: phone ? (str(phone, "status") as EnrichedProspect["phoneStatus"]) : undefined,
    firmographics:
      typeof row.firmographics === "object" && row.firmographics !== null
        ? (row.firmographics as Record<string, unknown>)
        : undefined,
    technographics: Array.isArray(row.technologies)
      ? (row.technologies as unknown[]).filter((t): t is string => typeof t === "string")
      : undefined,
    signals: signals.length > 0 ? signals : undefined,
  };
}

/** AgentSource-backed implementation of ProspectDataSource (rule 05). Never user-facing. */
export class ExploriumProspectData implements ProspectDataSource {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: ExploriumOptions = {}) {
    const apiKey = options.apiKey ?? process.env.EXPLORIUM_API_KEY;
    if (!apiKey) {
      throw new Error("EXPLORIUM_API_KEY is not set");
    }
    this.apiKey = apiKey;
    this.baseUrl = options.baseUrl ?? BASE_URL;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  private async post(path: string, body: unknown): Promise<ProviderRow[]> {
    const res = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", api_key: this.apiKey },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      // never include the request (it embeds nothing secret, but keep errors small) or the key
      throw new Error(`prospect data request failed (${res.status})`);
    }
    const json = (await res.json()) as { data?: unknown };
    return Array.isArray(json.data) ? (json.data as ProviderRow[]) : [];
  }

  async discoverProspects(filters: ProspectFilters, limit: number): Promise<ProspectCandidate[]> {
    const rows = await this.post(DISCOVER_PATH, {
      mode: "full",
      size: limit,
      page_size: Math.min(limit, 500),
      filters: buildFilters(filters),
    });
    return rows.map(toCandidate).filter((c) => c.externalRef && c.companyName);
  }

  async enrichProspects(externalRefs: string[]): Promise<EnrichedProspect[]> {
    if (externalRefs.length === 0) return [];
    const rows = await this.post(ENRICH_PATH, { prospect_ids: externalRefs });
    return rows.map(toEnriched).filter((c) => c.externalRef);
  }
}
