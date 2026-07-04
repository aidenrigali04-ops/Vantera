import { describe, expect, it, vi } from "vitest";
import {
  runAccountDeletion,
  type AccountDeletionStore,
  type PendingDeletionRequest,
} from "./account-deletion";

function fakeStore(
  pending: PendingDeletionRequest[],
  opts: {
    failOn?: Set<string>;
    refsByAccount?: Record<string, string[]>;
    orphans?: string[];
    failPauseOn?: Set<string>;
  } = {}
): AccountDeletionStore & { deleted: string[]; paused: string[] } {
  const deleted: string[] = [];
  const paused: string[] = [];
  return {
    deleted,
    paused,
    async listPendingDeletionRequests() {
      return pending;
    },
    async listOrphanAccountIds() {
      return opts.orphans ?? [];
    },
    async listAccountLinkedInRefs(accountId) {
      return opts.refsByAccount?.[accountId] ?? [];
    },
    async pauseAccountUsage(accountId) {
      if (opts.failPauseOn?.has(accountId)) throw new Error("pause boom");
      paused.push(accountId);
    },
    async deleteAccount(accountId) {
      if (opts.failOn?.has(accountId)) throw new Error("boom");
      deleted.push(accountId);
    },
  };
}

const noopDisconnect = async () => {};
const now = new Date("2026-06-20T00:00:00Z");
const past = new Date("2026-06-01T00:00:00Z"); // > 7 days → eligible
const recent = new Date("2026-06-18T00:00:00Z"); // < 7 days → still in grace

const NO_WORK = { processed: 0, skipped: 0, failed: 0, disconnected: 0, orphansProcessed: 0 };

describe("runAccountDeletion (rule 11 GDPR)", () => {
  it("hard-deletes accounts past the 7-day grace window", async () => {
    const store = fakeStore([{ accountId: "a", requestedAt: past }]);
    const summary = await runAccountDeletion({ store, disconnectLinkedIn: noopDisconnect, now: () => now });
    expect(store.deleted).toEqual(["a"]);
    expect(summary).toEqual({ ...NO_WORK, processed: 1 });
  });

  it("leaves accounts still inside the grace window untouched", async () => {
    const store = fakeStore([{ accountId: "a", requestedAt: recent }], { refsByAccount: { a: ["li_1"] } });
    const disconnect = vi.fn(noopDisconnect);
    const summary = await runAccountDeletion({ store, disconnectLinkedIn: disconnect, now: () => now });
    expect(store.deleted).toEqual([]);
    expect(disconnect).not.toHaveBeenCalled(); // never touch the provider for a not-yet-eligible account
    expect(summary).toEqual({ ...NO_WORK, skipped: 1 });
  });

  it("disconnects the account's LinkedIn connections BEFORE the hard delete", async () => {
    const order: string[] = [];
    const store = fakeStore([{ accountId: "a", requestedAt: past }], { refsByAccount: { a: ["li_1", "li_2"] } });
    const origDelete = store.deleteAccount.bind(store);
    store.deleteAccount = async (id) => {
      order.push(`delete:${id}`);
      return origDelete(id);
    };
    const disconnect = vi.fn(async (ref: string) => {
      order.push(`disconnect:${ref}`);
    });
    const summary = await runAccountDeletion({ store, disconnectLinkedIn: disconnect, now: () => now });
    expect(disconnect).toHaveBeenCalledTimes(2);
    expect(order).toEqual(["disconnect:li_1", "disconnect:li_2", "delete:a"]);
    expect(summary).toEqual({ ...NO_WORK, processed: 1, disconnected: 2 });
  });

  it("still hard-deletes when a provider disconnect fails (fail-open, reported)", async () => {
    const store = fakeStore([{ accountId: "a", requestedAt: past }], { refsByAccount: { a: ["li_1"] } });
    const onError = vi.fn();
    const disconnect = vi.fn(async () => {
      throw new Error("provider down");
    });
    const summary = await runAccountDeletion({ store, disconnectLinkedIn: disconnect, now: () => now, onError });
    expect(store.deleted).toEqual(["a"]); // erasure proceeds despite the vendor error
    expect(onError).toHaveBeenCalledWith("a", expect.any(Error));
    expect(summary).toEqual({ ...NO_WORK, processed: 1 });
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
    const summary = await runAccountDeletion({ store, disconnectLinkedIn: noopDisconnect, now: () => now, onError });
    expect(store.deleted).toEqual(["b"]); // b still processed after a threw
    expect(summary).toEqual({ ...NO_WORK, processed: 1, failed: 1 });
    expect(onError).toHaveBeenCalledWith("a", expect.any(Error));
  });
});

describe("runAccountDeletion — orphaned accounts (no members, no grace)", () => {
  it("quarantines spend FIRST, then disconnects, then erases — immediately", async () => {
    const order: string[] = [];
    const store = fakeStore([], { orphans: ["o1"], refsByAccount: { o1: ["li_9"] } });
    const origPause = store.pauseAccountUsage.bind(store);
    store.pauseAccountUsage = async (id) => {
      order.push(`pause:${id}`);
      return origPause(id);
    };
    const origDelete = store.deleteAccount.bind(store);
    store.deleteAccount = async (id) => {
      order.push(`delete:${id}`);
      return origDelete(id);
    };
    const disconnect = vi.fn(async (ref: string) => {
      order.push(`disconnect:${ref}`);
    });
    const summary = await runAccountDeletion({ store, disconnectLinkedIn: disconnect, now: () => now });
    expect(order).toEqual(["pause:o1", "disconnect:li_9", "delete:o1"]);
    expect(summary).toEqual({ ...NO_WORK, disconnected: 1, orphansProcessed: 1 });
  });

  it("still disconnects and erases when the quarantine step fails (fail-open, reported)", async () => {
    const store = fakeStore([], {
      orphans: ["o1"],
      refsByAccount: { o1: ["li_9"] },
      failPauseOn: new Set(["o1"]),
    });
    const onError = vi.fn();
    const summary = await runAccountDeletion({ store, disconnectLinkedIn: noopDisconnect, now: () => now, onError });
    expect(store.deleted).toEqual(["o1"]);
    expect(onError).toHaveBeenCalledWith("o1", expect.any(Error));
    expect(summary).toEqual({ ...NO_WORK, disconnected: 1, orphansProcessed: 1 });
  });

  it("never double-deletes an orphan already erased via its own request this sweep", async () => {
    const store = fakeStore([{ accountId: "a", requestedAt: past }], { orphans: ["a"] });
    const summary = await runAccountDeletion({ store, disconnectLinkedIn: noopDisconnect, now: () => now });
    expect(store.deleted).toEqual(["a"]); // once
    expect(store.paused).toEqual([]); // no pointless quarantine of an erased account
    expect(summary).toEqual({ ...NO_WORK, processed: 1 });
  });

  it("counts a failed orphan erasure as failed, and the sweep continues", async () => {
    const store = fakeStore([], { orphans: ["o1", "o2"], failOn: new Set(["o1"]) });
    const onError = vi.fn();
    const summary = await runAccountDeletion({ store, disconnectLinkedIn: noopDisconnect, now: () => now, onError });
    expect(store.deleted).toEqual(["o2"]);
    expect(store.paused).toEqual(["o1", "o2"]); // spend still stopped on the failed one
    expect(summary).toEqual({ ...NO_WORK, failed: 1, orphansProcessed: 1 });
  });
});
