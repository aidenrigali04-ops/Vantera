import type { ProspectSignal } from "./types";

/**
 * Company-event buying signals (rule 05/06/13). A tenant's Intent capability (Growth/Scale) tracks
 * company events — funding, M&A, exec hires, launches, partnerships, office openings — as buying
 * triggers alongside LinkedIn behavior. The data provider sits behind this interface (swappable,
 * never user-facing); `ProspectSignal` is the shared contract that flows into the AI rank + the
 * lead_signals "why now" display.
 */
export interface CompanyRef {
  name: string;
  domain?: string | null;
}

export interface CompanySignalSource {
  /** Company events per company, normalized to ProspectSignal, keyed by companyKey(ref).
   *  Implementations fail open: a bad fetch returns an empty map, never throws to the caller. */
  getCompanySignals(companies: CompanyRef[]): Promise<Map<string, ProspectSignal[]>>;
}

/** Stable per-company key: domain wins (canonical), else the name. Both lowercased/trimmed. */
export function companyKey(ref: CompanyRef): string {
  return (ref.domain?.trim() || ref.name.trim()).toLowerCase();
}

/** Deterministic headline → ProspectSignal.kind. Null = not a buying event (dropped, no noise). */
export function classifyCompanyEvent(headline: string): string | null {
  const h = headline.toLowerCase();
  if (/\bseries\s+[a-z]\b/.test(h) || /\b(raises?|raised|secures?|closes?)\b.*\b(round|seed|funding|\$)/.test(h)) return "funding";
  if (/\b(acquires?|acquired|acquisition|merger|merges?\s+with)\b/.test(h)) return "m_and_a";
  if (/\b(appoints?|names?|hires?|joins?\s+as|promotes?|new\s+(ceo|cfo|cto|coo|vp|chief|head\s+of))\b/.test(h)) return "exec_hire";
  if (/\b(launches?|unveils?|introduces?)\b/.test(h) || /\breleases?\s+new\s+(product|platform)\b/.test(h)) return "product_launch";
  if (/\b(partners?\s+with|partnership|teams?\s+up\s+with)\b/.test(h) || /\bintegrat/.test(h)) return "partnership";
  if (/\bnew\s+office\b/.test(h) || /\bopens?\s+.*\b(office|headquarters)\b/.test(h) || /\bexpands?\s+to\b/.test(h)) return "office_opening";
  return null;
}

/** Deterministic in-memory source — the tests' double and the default when no provider is configured. */
export class InMemoryCompanySignals implements CompanySignalSource {
  constructor(private readonly seed: Map<string, ProspectSignal[]> = new Map()) {}
  async getCompanySignals(companies: CompanyRef[]): Promise<Map<string, ProspectSignal[]>> {
    const out = new Map<string, ProspectSignal[]>();
    for (const c of companies) {
      const sig = this.seed.get(companyKey(c));
      if (sig && sig.length > 0) out.set(companyKey(c), sig);
    }
    return out;
  }
}
