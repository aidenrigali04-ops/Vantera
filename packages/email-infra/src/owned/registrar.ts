/** Buys/owns domains. Name.com in prod; vendor-neutral here. */
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

export interface NameComRegistrarConfig { username: string; token: string; fetchFn?: typeof fetch; baseUrl?: string }

interface NameComAvailability { purchasable: boolean; purchasePrice?: number }

/**
 * Name.com Core API v4 registrar. Unlike Cloudflare/Porkbun, Name.com exposes a real
 * new-domain registration endpoint (POST /v4/domains), which is what the "buy a fresh
 * domain on the platform" flow needs. Auth is HTTP Basic (username:token).
 */
export class NameComRegistrar implements DomainRegistrar {
  private readonly fetchFn: typeof fetch;
  private readonly base: string;
  constructor(private readonly cfg: NameComRegistrarConfig) {
    this.fetchFn = cfg.fetchFn ?? fetch;
    // prod: https://api.name.com  · sandbox: https://api.dev.name.com
    this.base = cfg.baseUrl ?? "https://api.name.com";
  }
  private h() {
    const basic = Buffer.from(`${this.cfg.username}:${this.cfg.token}`).toString("base64");
    return { Authorization: `Basic ${basic}`, "Content-Type": "application/json" };
  }
  private async check(domain: string): Promise<NameComAvailability> {
    const res = await this.fetchFn(`${this.base}/v4/domains:checkAvailability`, {
      method: "POST", headers: this.h(), body: JSON.stringify({ domainNames: [domain] }),
    });
    if (!res.ok) throw new Error(`registrar availability check failed for ${domain}: ${res.status}`);
    const data = (await res.json()) as { results?: Array<{ domainName: string; purchasable?: boolean; purchasePrice?: number }> };
    const result = data.results?.find((r) => r.domainName === domain) ?? data.results?.[0];
    return { purchasable: result?.purchasable === true, purchasePrice: result?.purchasePrice };
  }
  async isAvailable(domain: string): Promise<boolean> {
    return (await this.check(domain)).purchasable;
  }
  async buy(domain: string): Promise<void> {
    // Name.com requires the quoted price to confirm a registration, so check first.
    const { purchasable, purchasePrice } = await this.check(domain);
    if (!purchasable) throw new Error(`domain unavailable: ${domain}`);
    const res = await this.fetchFn(`${this.base}/v4/domains`, {
      method: "POST", headers: this.h(),
      body: JSON.stringify({ domain: { domainName: domain }, purchasePrice }),
    });
    if (!res.ok) throw new Error(`registrar purchase failed for ${domain}: ${res.status}`);
  }
}
