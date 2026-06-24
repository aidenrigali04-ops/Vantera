import {
  classifyCompanyEvent,
  companyKey,
  type CompanyRef,
  type CompanySignalSource,
} from "./company-signals";
import type { ProspectSignal } from "./types";

type Item = Record<string, unknown>;
const DEFAULT_BASE_URL = "https://api.apify.com";
const DEFAULT_RECENCY_DAYS = 90;

/** First non-empty string among the candidate keys (actors name the same field differently). */
function str(item: Item, ...keys: string[]): string | undefined {
  for (const k of keys) {
    const v = item[k];
    if (typeof v === "string" && v.trim().length > 0) return v.trim();
  }
  return undefined;
}

/**
 * Company-news → buying signals (rule 05/13). The data provider is an implementation detail behind
 * CompanySignalSource — its name never leaves this file (white-label). One actor call covers the
 * batch; each headline is classified deterministically and only recent, recognized events are kept.
 * Fails open: any error or non-200 yields an empty map, so a flaky read never breaks a Scout run
 * (rule 04 — prospecting never halts on a signal read).
 *
 * Actor output schemas vary; field extraction is defensive (title/companyName/date under common
 * aliases). Verify against the specific actor set in APIFY_COMPANY_NEWS_ACTOR — a schema mismatch
 * degrades to fewer signals, never a crash.
 */
export class ApifyCompanySignals implements CompanySignalSource {
  private readonly token: string;
  private readonly actorId: string;
  private readonly recencyDays: number;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly now: () => Date;

  constructor(opts: {
    token: string;
    actorId: string;
    recencyDays?: number;
    baseUrl?: string;
    fetchImpl?: typeof fetch;
    now?: () => Date;
  }) {
    this.token = opts.token;
    this.actorId = opts.actorId;
    this.recencyDays = opts.recencyDays ?? DEFAULT_RECENCY_DAYS;
    this.baseUrl = opts.baseUrl ?? DEFAULT_BASE_URL;
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.now = opts.now ?? (() => new Date());
  }

  async getCompanySignals(companies: CompanyRef[]): Promise<Map<string, ProspectSignal[]>> {
    const out = new Map<string, ProspectSignal[]>();
    if (companies.length === 0) return out;

    let items: Item[] = [];
    try {
      const actor = this.actorId.replace("/", "~");
      const res = await this.fetchImpl(`${this.baseUrl}/v2/acts/${actor}/run-sync-get-dataset-items`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${this.token}` },
        body: JSON.stringify({
          companies: companies.map((c) => ({ name: c.name, domain: c.domain ?? undefined })),
        }),
      });
      if (!res.ok) return out; // fail open
      const json = (await res.json()) as unknown;
      items = Array.isArray(json)
        ? (json as Item[])
        : Array.isArray((json as { items?: unknown }).items)
          ? (json as { items: Item[] }).items
          : Array.isArray((json as { data?: unknown }).data)
            ? (json as { data: Item[] }).data
            : [];
    } catch {
      return out; // fail open
    }

    const cutoff = this.now().getTime() - this.recencyDays * 86_400_000;
    for (const item of items) {
      const headline = str(item, "title", "headline", "summary");
      const name = str(item, "companyName", "company", "name");
      if (!headline || !name) continue;
      const kind = classifyCompanyEvent(headline);
      if (!kind) continue;
      const dateStr = str(item, "date", "publishedAt", "published_at", "time");
      const when = dateStr ? Date.parse(dateStr) : NaN;
      if (Number.isFinite(when) && when < cutoff) continue; // stale ≠ active intent
      const key = companyKey({ name, domain: str(item, "companyDomain", "domain") ?? null });
      const sig: ProspectSignal = { kind, detail: headline, label: headline, observedAt: dateStr };
      const list = out.get(key) ?? [];
      list.push(sig);
      out.set(key, list);
    }
    return out;
  }
}
