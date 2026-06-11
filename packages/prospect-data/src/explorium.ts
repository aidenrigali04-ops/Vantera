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
const ENRICH_PATH = "/prospects/bulk_enrich";

export interface ExploriumOptions {
  apiKey?: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}

type FilterValues = { values: string[] };

function buildFilters(filters: ProspectFilters): Record<string, FilterValues> {
  const out: Record<string, FilterValues> = {};
  if (filters.industries?.length) out.company_industry = { values: filters.industries };
  if (filters.companySizes?.length) out.company_size = { values: filters.companySizes };
  if (filters.titles?.length) out.job_title = { values: filters.titles };
  if (filters.seniorities?.length) out.job_seniority_level = { values: filters.seniorities };
  if (filters.geos?.length) out.country_name = { values: filters.geos };
  if (filters.techStack?.length) out.company_technologies = { values: filters.techStack };
  if (filters.signals?.length) out.events = { values: filters.signals };
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
      mode: "preview",
      size: limit,
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
