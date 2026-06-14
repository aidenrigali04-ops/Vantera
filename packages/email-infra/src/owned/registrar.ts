/** Buys/owns domains. Cloudflare Registrar in prod; vendor-neutral here. */
export interface DomainRegistrar {
  isAvailable(domain: string): Promise<boolean>;
  buy(domain: string): Promise<void>;
}

export class InMemoryRegistrar implements DomainRegistrar {
  readonly purchased: string[] = [];
  private readonly taken: Set<string>;
  constructor(opts: { taken?: string[] } = {}) {
    this.taken = new Set(opts.taken ?? []);
  }
  async isAvailable(domain: string): Promise<boolean> {
    return !this.taken.has(domain) && !this.purchased.includes(domain);
  }
  async buy(domain: string): Promise<void> {
    if (!(await this.isAvailable(domain))) throw new Error(`domain unavailable: ${domain}`);
    this.purchased.push(domain);
  }
}

export interface CloudflareRegistrarConfig { apiToken: string; accountId: string; fetchFn?: typeof fetch; baseUrl?: string }

export class CloudflareRegistrar implements DomainRegistrar {
  private readonly fetchFn: typeof fetch;
  private readonly base: string;
  constructor(private readonly cfg: CloudflareRegistrarConfig) {
    this.fetchFn = cfg.fetchFn ?? fetch;
    this.base = cfg.baseUrl ?? "https://api.cloudflare.com/client/v4";
  }
  private h() { return { Authorization: `Bearer ${this.cfg.apiToken}`, "Content-Type": "application/json" }; }
  async isAvailable(domain: string): Promise<boolean> {
    const res = await this.fetchFn(`${this.base}/accounts/${this.cfg.accountId}/registrar/domains/${domain}`, { headers: this.h() });
    if (!res.ok) return false;
    const data = (await res.json()) as { result?: { available?: boolean } };
    return data.result?.available === true;
  }
  async buy(domain: string): Promise<void> {
    const res = await this.fetchFn(`${this.base}/accounts/${this.cfg.accountId}/registrar/domains/${domain}`, {
      method: "PUT", headers: this.h(), body: JSON.stringify({ enabled: true, auto_renew: true }),
    });
    if (!res.ok) throw new Error(`registrar purchase failed for ${domain}: ${res.status}`);
  }
}
