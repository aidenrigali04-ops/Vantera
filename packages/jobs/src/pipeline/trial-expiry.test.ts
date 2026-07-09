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

describe("runTrialExpiry lifecycle chaining (0045)", () => {
  it("captures lapsing accounts as trial_lapsed touches BEFORE the flip", async () => {
    const calls: string[] = [];
    const s: TrialStore = {
      getExpiredTrialAccounts: vi.fn(async () => [{ id: "a" }, { id: "b" }]),
      expireTrials: vi.fn(async (ids: string[]) => {
        calls.push("expire");
        return ids.length;
      }),
    };
    const lifecycle = {
      enqueueTrialLapsedForAccounts: vi.fn(async (ids: string[]) => {
        calls.push("enqueue");
        return ids.length;
      }),
    };
    await runTrialExpiry({ store: s, lifecycle });
    expect(lifecycle.enqueueTrialLapsedForAccounts).toHaveBeenCalledWith(["a", "b"]);
    expect(calls).toEqual(["enqueue", "expire"]); // capture must precede the flip
  });

  it("skips the lifecycle hook when nothing lapsed", async () => {
    const lifecycle = { enqueueTrialLapsedForAccounts: vi.fn(async () => 0) };
    await runTrialExpiry({
      store: { getExpiredTrialAccounts: vi.fn(async () => []), expireTrials: vi.fn(async () => 0) },
      lifecycle,
    });
    expect(lifecycle.enqueueTrialLapsedForAccounts).not.toHaveBeenCalled();
  });

  it("still works with no lifecycle dep (backward compatible)", async () => {
    const summary = await runTrialExpiry({
      store: { getExpiredTrialAccounts: vi.fn(async () => [{ id: "a" }]), expireTrials: vi.fn(async () => 1) },
    });
    expect(summary.expired).toBe(1);
  });
});
