import type {
  EnrichedProspect,
  ProspectCandidate,
  ProspectDataSource,
  ProspectFilters,
  ProspectRef,
} from "./types";

// Endpoint paths and filter keys live here only; verify against the AgentSource API
// reference when wiring live (the adapter contract is covered by tests with a fetch stub).
const BASE_URL = "https://api.explorium.ai/v1";
const DISCOVER_PATH = "/prospects";
const ENRICH_PATH = "/prospects/contacts_information/bulk_enrich";
// Firmographics (industry / employee count / revenue) live on the BUSINESS, keyed by business_id —
// they are not on the /prospects row, so they must be fetched separately and joined per prospect.
const FIRMOGRAPHICS_PATH = "/businesses/firmographics/bulk_enrich";

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
  // default to the full decision-maker spread so a title-only ICP (e.g. "VP of Operations",
  // "Director of Sales") still surfaces the right people. The earlier owner/c-suite/founder
  // default silently excluded VPs and directors, so role-titled ICPs matched almost nothing.
  out.job_level = {
    values:
      jobLevels.length > 0
        ? jobLevels
        : ["owner", "founder", "c-suite", "partner", "vice president", "director"],
  };

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
    businessId: str(row, "business_id"),
    companyName: str(row, "company_name") ?? "",
    companyDomain: str(row, "company_website"),
    // company_size / company_industry are NOT on the /prospects row — they come from the
    // firmographics enrichment (by business_id). Discovery leaves them undefined.
    companySize: str(row, "company_size"),
    industry: str(row, "company_industry"),
    location: str(row, "country_name"),
    firstName: str(row, "first_name"),
    lastName: str(row, "last_name"),
    title: str(row, "job_title"),
    linkedinUrl: str(row, "linkedin"),
  };
}

function mapEmailStatus(s: string | undefined): EnrichedProspect["emailStatus"] {
  if (s === "valid") return "valid";
  if (s === "invalid") return "invalid";
  return s ? "risky" : undefined;
}

/**
 * Build an EnrichedProspect from the contacts-enrich payload (nested under `data`) joined with
 * the business firmographics payload. The contacts response shape is:
 *   { prospect_id, data: { emails:[{address,type}], professions_email, professional_email_status,
 *                          phone_numbers:[{phone_number}], mobile_phone } }
 * and firmographics: { data: { linkedin_industry_category, number_of_employees_range, name, ... } }.
 */
function buildEnriched(externalRef: string, contact: ProviderRow, firmo: ProviderRow): EnrichedProspect {
  const emails = Array.isArray(contact.emails) ? (contact.emails as ProviderRow[]) : [];
  const professional = emails.find((e) => str(e, "type") === "current_professional");
  const email = str(contact, "professions_email") ?? (professional ? str(professional, "address") : undefined) ?? (emails[0] ? str(emails[0], "address") : undefined);

  const phones = Array.isArray(contact.phone_numbers) ? (contact.phone_numbers as ProviderRow[]) : [];
  const phone = str(contact, "mobile_phone") ?? (phones[0] ? str(phones[0], "phone_number") : undefined);

  const technographics = Array.isArray(firmo.technologies)
    ? (firmo.technologies as unknown[]).filter((t): t is string => typeof t === "string")
    : undefined;

  return {
    externalRef,
    companyName: str(firmo, "name") ?? "",
    companyDomain: str(firmo, "website"),
    // Firmographics → the fields the rules gate / AI rank actually need (rule 06).
    industry: str(firmo, "linkedin_industry_category") ?? str(firmo, "naics_description"),
    companySize: str(firmo, "number_of_employees_range"),
    location: str(firmo, "country_name"),
    email,
    emailStatus: mapEmailStatus(str(contact, "professional_email_status")),
    phone,
    phoneStatus: phone ? "valid" : undefined,
    firmographics: Object.keys(firmo).length > 0 ? firmo : undefined,
    technographics: technographics && technographics.length > 0 ? technographics : undefined,
    signals: undefined,
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

  async enrichProspects(refs: ProspectRef[]): Promise<EnrichedProspect[]> {
    if (refs.length === 0) return [];
    const prospectIds = refs.map((r) => r.externalRef);

    // contacts (emails / phones), keyed by prospect_id; response rows nest payload under `data`
    const contactRows = await this.post(ENRICH_PATH, { prospect_ids: prospectIds });
    const contactByRef = new Map<string, ProviderRow>();
    for (const row of contactRows) {
      const pid = str(row, "prospect_id");
      const data = typeof row.data === "object" && row.data !== null ? (row.data as ProviderRow) : {};
      if (pid) contactByRef.set(pid, data);
    }

    // firmographics (industry / employee count), keyed by business_id — one call for the
    // unique businesses among the refs; refs without a businessId simply get no firmographics.
    const businessIds = [...new Set(refs.map((r) => r.businessId).filter((b): b is string => Boolean(b)))];
    const firmoByBusiness = new Map<string, ProviderRow>();
    if (businessIds.length > 0) {
      const firmoRows = await this.post(FIRMOGRAPHICS_PATH, { business_ids: businessIds });
      for (const row of firmoRows) {
        const bid = str(row, "business_id");
        const data = typeof row.data === "object" && row.data !== null ? (row.data as ProviderRow) : {};
        if (bid) firmoByBusiness.set(bid, data);
      }
    }

    return refs.map((ref) =>
      buildEnriched(
        ref.externalRef,
        contactByRef.get(ref.externalRef) ?? {},
        (ref.businessId ? firmoByBusiness.get(ref.businessId) : undefined) ?? {}
      )
    );
  }
}
