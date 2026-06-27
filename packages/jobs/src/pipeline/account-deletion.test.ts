import { describe, expect, it, vi } from "vitest";
import {
  runAccountDeletion,
  type AccountDeletionStore,
  type PendingDeletionRequest,
} from "./account-deletion";

function fakeStore(
  pending: PendingDeletionRequest[],
  opts: { failOn?: Set<string> } = {}
): AccountDeletionStore & { deleted: string[] } {
  const deleted: string[] = [];
  return {
    deleted,
    async listPendingDeletionRequests() {
      return pending;
    },
    async deleteAccount(accountId) {
      if (opts.failOn?.has(accountId)) throw new Error("boom");
      deleted.push(accountId);
    },
  };
}

const now = new Date("2026-06-20T00:00:00Z");
const past = new Date("2026-06-01T00:00:00Z"); // > 7 days → eligible
const recent = new Date("2026-06-18T00:00:00Z"); // < 7 days → still in grace

describe("runAccountDeletion (rule 11 GDPR)", () => {
  it("hard-deletes accounts past the 7-day grace window", async () => {
    const store = fakeStore([{ accountId: "a", requestedAt: past }]);
    const summary = await runAccountDeletion({ store, now: () => now });
    expect(store.deleted).toEqual(["a"]);
    expect(summary).toEqual({ processed: 1, skipped: 0, failed: 0 });
  });

  it("leaves accounts still inside the grace window untouched", async () => {
    const store = fakeStore([{ accountId: "a", requestedAt: recent }]);
    const summary = await runAccountDeletion({ store, now: () => now });
    expect(store.deleted).toEqual([]);
    expect(summary).toEqual({ processed: 0, skipped: 1, failed: 0 });
  });

  it("continues the sweep when one delete fails, and reports it", async () => {
    const store = fakeStore(
      [
        { accountId: "a", requestedAt: past },
        { accountId: "b", requestedAt: past },
      ],
      { failOn: new Set(["a"]) }
    );
    const onError = vi.fn();
    const summary = await runAccountDeletion({ store, now: () => now, onError });
    expect(store.deleted).toEqual(["b"]); // b still processed after a threw
    expect(summary).toEqual({ processed: 1, skipped: 0, failed: 1 });
    expect(onError).toHaveBeenCalledWith("a", expect.any(Error));
  });
});
