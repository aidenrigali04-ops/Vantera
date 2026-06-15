import { describe, expect, it, vi } from "vitest";
import { runTrialExpiry } from "./trial-expiry";
import type { ExpiredTrialAccount, TrialStore } from "./types";

function store(expired: ExpiredTrialAccount[]): TrialStore & {
  expireTrials: ReturnType<typeof vi.fn>;
} {
  return {
    getExpiredTrialAccounts: vi.fn(async () => expired),
    expireTrials: vi.fn(async (ids: string[]) => ids.length),
  };
}

describe("runTrialExpiry", () => {
  it("expires every lapsed trial the store returns", async () => {
    const s = store([{ id: "a" }, { id: "b" }]);
    const summary = await runTrialExpiry({ store: s });
    expect(summary).toEqual({ status: "completed", expired: 2 });
    expect(s.expireTrials).toHaveBeenCalledWith(["a", "b"]);
  });

  it("does nothing (no write) when no trial has lapsed", async () => {
    const s = store([]);
    const summary = await runTrialExpiry({ store: s });
    expect(summary.expired).toBe(0);
    expect(s.expireTrials).not.toHaveBeenCalled();
  });

  it("passes the injected clock to the store", async () => {
    const s = store([]);
    const now = new Date("2026-06-14T00:00:00.000Z");
    await runTrialExpiry({ store: s, now: () => now });
    expect(s.getExpiredTrialAccounts).toHaveBeenCalledWith(now);
  });
});
