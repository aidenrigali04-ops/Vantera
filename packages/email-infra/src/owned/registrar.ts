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
