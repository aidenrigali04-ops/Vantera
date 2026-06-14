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
