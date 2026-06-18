import type {
  EnrichedProspect,
  ProspectCandidate,
  ProspectDataSource,
  ProspectFilters,
  ProspectRef,
  ProspectSignal,
} from "./types";

// Endpoint paths and filter keys live here only; verify against the AgentSource API
// reference when wiring live (the adapter contract is covered by tests with a fetch stub).
const BASE_URL = "https://api.explorium.ai/v1";
const DISCOVER_PATH = "/prospects";
const ENRICH_PATH = "/prospects/contacts_information/bulk_enrich";
// Firmographics (industry / employee count / revenue) live on the BUSINESS, keyed by business_id —
// they are not on the /prospects row, so they must be fetched separately and joined per prospect.
const FIRMOGRAPHICS_PATH = "/businesses/firmographics/bulk_enrich";
// Buying signals, keyed by business_id (rule 05 waterfall, survivors only). Company EVENTS (funding,
// office moves, product launches, M&A, hiring/workforce, …) and INTENT (level + topics). Both are
// best-effort: a failure or disabled endpoint degrades to no signals — it never breaks the core
// email/firmographics enrichment.
//   EVENTS — the type taxonomy is VERIFIED against the live AgentSource enum (canonical underscore
//     tokens like new_funding_round / new_product / cost_cutting / hiring_in_sales_department);
//     normalizeEvent() maps those tokens. The bulk REST path below is assumed — verify at live-wire.
//   INTENT — NOT exposed in the current AgentSource enrich interface we verified; the path/shape are
//     assumed. If unavailable it simply 404s (postSafe) and no intent signal is produced.
// The mapping contract is covered by stub tests.
const EVENTS_PATH = "/businesses/events";
const INTENT_PATH = "/businesses/intent/bulk_enrich";

export interface ExploriumOptions {
  apiKey?: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}

type FilterValues = { values: string[] };

// AgentSource /v1/prospects is a strict (Pydantic) schema: unknown filter keys and bad enum
// values both 422. Keys + enums below are verified against the live API. We send four direct-use
// filters: job_level, company_size, company_country_code, and linkedin_category. The industry
// filter is the big quality lever — without it discovery matches on title alone and returns
// off-ICP public figures (CEOs of media/finance/wellness cos). linkedin_category needs EXACT
// LinkedIn-taxonomy values (free-text 422s), so ICP industries are mapped to a verified-valid set
// below; unmapped industries are simply dropped (never sent raw). techStack/signals still ride
// enrichment + the rules gate (rule 06), not discovery.

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

// Free-text ICP industry keyword → EXACT LinkedIn-taxonomy categories (all verified valid against
// the live /prospects schema; sending an unknown value 422s the whole call). Matching is substring,
// case-insensitive; an ICP industry that matches no keyword contributes nothing (so a partially-
// mappable ICP still filters on what it can, and a fully-unmappable one falls back to no industry
// filter rather than erroring).
const LINKEDIN_CATEGORY_MAP: { match: string[]; categories: string[] }[] = [
  { match: ["saas", "software"], categories: ["software development"] },
  { match: [" ai ", "artificial intelligence", "machine learning", " ml "], categories: ["software development", "technology, information and internet"] },
  { match: [" tech ", "technology", "internet", "information technology"], categories: ["technology, information and internet"] },
  { match: ["it services", "it consulting", "managed services"], categories: ["it services and it consulting"] },
  { match: ["security", "cyber"], categories: ["computer and network security"] },
  { match: ["analytics", "data infrastructure"], categories: ["data infrastructure and analytics"] },
  { match: ["advertising", "ad agency", " ads "], categories: ["advertising services"] },
  { match: ["marketing", "demand gen", "growth"], categories: ["marketing services"] },
  { match: ["agency", "agencies"], categories: ["advertising services", "marketing services"] },
  { match: ["fintech", "finance", "financial", "banking", "payments"], categories: ["financial services"] },
  { match: ["consult"], categories: ["business consulting and services"] },
  { match: ["health", "medical", "hospital", "clinic", "biotech", "pharma"], categories: ["hospitals and health care"] },
  { match: ["ecommerce", "e-commerce", "retail", "commerce", "dtc", "consumer goods"], categories: ["retail"] },
  { match: ["real estate", "property", "proptech"], categories: ["real estate"] },
  { match: ["staffing", "recruit", "talent acquisition"], categories: ["staffing and recruiting"] },
  { match: ["telecom"], categories: ["telecommunications"] },
  { match: ["manufactur", "industrial"], categories: ["manufacturing"] },
  { match: ["insurance", "insurtech"], categories: ["insurance"] },
  { match: ["education", "edtech", "e-learning", "elearning", "learning", "training"], categories: ["e-learning providers"] },
  { match: ["human resources", " hr ", "people ops", "hrtech"], categories: ["human resources services"] },
  { match: ["accounting", "bookkeeping"], categories: ["accounting"] },
  { match: ["legal", "law firm", "legaltech"], categories: ["legal services"] },
  { match: ["media", "publishing", "content", "news"], categories: ["internet publishing"] },
];

/** Map ICP industry strings onto the verified LinkedIn-category taxonomy (deduped, case-insensitive). */
function mapLinkedinCategories(industries: string[]): string[] {
  const out = new Set<string>();
  for (const raw of industries) {
    const v = ` ${raw.toLowerCase()} `;
    for (const { match, categories } of LINKEDIN_CATEGORY_MAP) {
      if (match.some((m) => v.includes(m))) categories.forEach((c) => out.add(c));
    }
  }
  return [...out];
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

  // Industry filter — the quality lever. Only verified-valid taxonomy values are emitted;
  // an ICP whose industries don't map sends no linkedin_category (broad, but never 422s).
  const categories = mapLinkedinCategories(filters.industries ?? []);
  if (categories.length > 0) out.linkedin_category = { values: categories };

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

// Default human label per normalized kind.
const KIND_LABEL: Record<string, string> = {
  funding: "Raised new funding",
  product_launch: "Launched a new product",
  office_opening: "Opening a new office",
  office_closing: "Closing an office",
  partnership: "Announced a partnership",
  award: "Won an award",
  m_and_a: "Merger or acquisition",
  cost_cutting: "Cost-cutting underway",
  legal: "Legal proceedings",
  security: "Security incident",
  hiring: "Actively hiring",
  workforce: "Growing the team",
  exec_hire: "New executive hire",
};

// Collapse a provider event type onto the stable kind set the UI groups on. Handles BOTH the
// canonical AgentSource event-type TOKENS (verified against the live taxonomy — e.g. new_funding_round,
// new_product, closing_office, merger_and_acquisitions, cost_cutting, hiring_in_sales_department,
// increase_in_all_departments, outages_and_security_breaches, lawsuits_and_legal_issues) AND
// human-readable variants, so the mapping is robust whichever form the API returns.
function eventKind(typeRaw: string): string {
  const t = typeRaw.toLowerCase().trim();
  if (/ipo|funding|investment/.test(t)) return "funding";
  if (t.includes("new_product") || /product launch|new product/.test(t)) return "product_launch";
  if (t.includes("new_office") || /new office|office opening|expansion/.test(t)) return "office_opening";
  if (t.includes("closing_office") || /office clos|site closure|shutdown/.test(t)) return "office_closing";
  if (t.includes("partnership") || t.includes("alliance")) return "partnership";
  if (t.includes("award")) return "award";
  if (t.includes("merger") || t.includes("acquisi")) return "m_and_a";
  if (t.includes("cost_cutting") || t.startsWith("decrease_in") || /cost cut|layoff|downsiz/.test(t))
    return "cost_cutting";
  if (t.includes("lawsuit") || t.includes("legal")) return "legal";
  if (t.includes("outages") || t.includes("breach") || /security (incident|breach)/.test(t))
    return "security";
  if (t.startsWith("hiring_in") || t === "employee_joined_company" || /hiring|job opening|recruiting/.test(t))
    return "hiring";
  if (t.startsWith("increase_in") || /workforce|headcount/.test(t)) return "workforce";
  if (/exec|c-level|chief|cxo|leadership hire/.test(t)) return "exec_hire";
  return "other";
}

function normalizeEvent(typeRaw: string): { kind: string; label: string } {
  const kind = eventKind(typeRaw);
  return { kind, label: KIND_LABEL[kind] ?? typeRaw };
}

// Assumed events shape (verify at live-wire): data:[{ business_id, data:{ events:[{ type, description,
// event_time }] } }]. Tolerant: accepts events under data.events or a bare data array; skips rows
// without a type. Caller keys by business_id.
function signalsFromEvents(eventsData: unknown): ProspectSignal[] {
  const list = Array.isArray(eventsData)
    ? eventsData
    : Array.isArray((eventsData as ProviderRow | undefined)?.events)
      ? ((eventsData as ProviderRow).events as unknown[])
      : [];
  const out: ProspectSignal[] = [];
  for (const e of list) {
    if (typeof e !== "object" || e === null) continue;
    const row = e as ProviderRow;
    const type = str(row, "type") ?? str(row, "event_type") ?? str(row, "category");
    if (!type) continue;
    const { kind, label } = normalizeEvent(type);
    out.push({
      kind,
      label,
      detail: str(row, "description") ?? str(row, "summary") ?? type,
      observedAt: str(row, "event_time") ?? str(row, "date") ?? str(row, "timestamp"),
    });
  }
  return out;
}

// Assumed intent shape (verify at live-wire): data:{ intent_level, intent_topics:[{ topic, score }] }.
// Emits a single rolled-up intent signal; null when there's no meaningful level.
function signalFromIntent(intentData: unknown): ProspectSignal | null {
  if (typeof intentData !== "object" || intentData === null) return null;
  const row = intentData as ProviderRow;
  const levelRaw = (str(row, "intent_level") ?? str(row, "level") ?? "").toLowerCase();
  if (!levelRaw || levelRaw === "none") return null;
  const level = levelRaw.replace(/[\s-]+/g, "_"); // "in depth" / "in-depth" → "in_depth"
  const topicsRaw = Array.isArray(row.intent_topics) ? (row.intent_topics as ProviderRow[]) : [];
  const topics = topicsRaw
    .map((t) => str(t, "topic") ?? str(t, "name"))
    .filter((t): t is string => Boolean(t));
  const label = topics.length > 0 ? `Researching ${topics.slice(0, 2).join(", ")}` : "Showing buying intent";
  return {
    kind: "intent",
    label,
    level,
    detail: topics.length > 0 ? topics.join(", ") : "Active buying intent detected",
  };
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

  // Best-effort POST for additive enrichment (signals): swallows any failure and returns [] so a
  // disabled/erroring signals endpoint degrades gracefully instead of breaking core enrichment.
  private async postSafe(path: string, body: unknown): Promise<ProviderRow[]> {
    try {
      return await this.post(path, body);
    } catch {
      return [];
    }
  }

  // Fetch company events + intent for the given businesses and roll them into per-business signals.
  // Best-effort throughout (postSafe); company-level signals attach to every prospect at that business.
  private async fetchSignals(businessIds: string[]): Promise<Map<string, ProspectSignal[]>> {
    const byBusiness = new Map<string, ProspectSignal[]>();
    if (businessIds.length === 0) return byBusiness;

    const add = (bid: string, signals: ProspectSignal[]) => {
      if (signals.length === 0) return;
      byBusiness.set(bid, [...(byBusiness.get(bid) ?? []), ...signals]);
    };
    const payloadOf = (row: ProviderRow): unknown =>
      typeof row.data === "object" && row.data !== null ? row.data : row;

    const [eventRows, intentRows] = await Promise.all([
      this.postSafe(EVENTS_PATH, { business_ids: businessIds }),
      this.postSafe(INTENT_PATH, { business_ids: businessIds }),
    ]);

    for (const row of eventRows) {
      const bid = str(row, "business_id");
      if (bid) add(bid, signalsFromEvents(payloadOf(row)));
    }
    for (const row of intentRows) {
      const bid = str(row, "business_id");
      const intent = bid ? signalFromIntent(payloadOf(row)) : null;
      if (bid && intent) add(bid, [intent]);
    }
    return byBusiness;
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

    // buying signals (events + intent), best-effort, keyed by the same business_ids
    const signalsByBusiness = await this.fetchSignals(businessIds);

    return refs.map((ref) => {
      const enriched = buildEnriched(
        ref.externalRef,
        contactByRef.get(ref.externalRef) ?? {},
        (ref.businessId ? firmoByBusiness.get(ref.businessId) : undefined) ?? {}
      );
      const signals = ref.businessId ? signalsByBusiness.get(ref.businessId) : undefined;
      return signals && signals.length > 0 ? { ...enriched, signals } : enriched;
    });
  }
}
