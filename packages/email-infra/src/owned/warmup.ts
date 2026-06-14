export interface WarmupSnapshot { phase: "warming" | "ready"; dailyCap: number }

/** Outsourced warmup network. Keyed by mailbox email address. */
export interface WarmupService {
  enroll(address: string): Promise<void>;
  status(address: string): Promise<WarmupSnapshot>;
}

export class InMemoryWarmup implements WarmupService {
  private readonly state = new Map<string, WarmupSnapshot>();
  async enroll(address: string): Promise<void> {
    this.state.set(address, { phase: "warming", dailyCap: 10 });
  }
  async status(address: string): Promise<WarmupSnapshot> {
    return this.state.get(address) ?? { phase: "warming", dailyCap: 0 };
  }
  markReady(address: string, dailyCap: number): void {
    this.state.set(address, { phase: "ready", dailyCap });
  }
}

export interface ApiWarmupConfig { apiKey: string; fetchFn?: typeof fetch; baseUrl?: string }

export class ApiWarmup implements WarmupService {
  private readonly fetchFn: typeof fetch;
  private readonly base: string;
  constructor(private readonly cfg: ApiWarmupConfig) {
    this.fetchFn = cfg.fetchFn ?? fetch;
    this.base = cfg.baseUrl ?? "https://api.warmup.example/v1";
  }
  private h() { return { Authorization: `Bearer ${this.cfg.apiKey}`, "Content-Type": "application/json" }; }
  async enroll(address: string): Promise<void> {
    const res = await this.fetchFn(`${this.base}/mailboxes`, { method: "POST", headers: this.h(), body: JSON.stringify({ email: address }) });
    if (!res.ok && res.status !== 409) throw new Error(`warmup enroll failed ${address}: ${res.status}`);
  }
  async status(address: string): Promise<WarmupSnapshot> {
    const res = await this.fetchFn(`${this.base}/mailboxes/${encodeURIComponent(address)}`, { headers: this.h() });
    if (!res.ok) return { phase: "warming", dailyCap: 0 };
    const data = (await res.json()) as { state?: string; daily_limit?: number };
    return { phase: data.state === "ready" ? "ready" : "warming", dailyCap: typeof data.daily_limit === "number" ? data.daily_limit : 0 };
  }
}
