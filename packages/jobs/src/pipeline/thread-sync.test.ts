import { describe, expect, it } from "vitest";
import { InMemoryLinkedInInfra, type ThreadMessageEvent } from "@vantera/linkedin-infra";
import {
  THREAD_SYNC_LEADS_PER_ACCOUNT,
  THREAD_SYNC_QUIET_MS,
  runThreadSync,
  type ThreadSyncCandidate,
  type ThreadSyncStore,
} from "./thread-sync";

const NOW = new Date("2026-10-27T12:00:00.000Z");

function candidate(over: Partial<ThreadSyncCandidate> = {}): ThreadSyncCandidate {
  return { leadId: "lead1", accountId: "acc1", attendeeProviderRef: "ACoAA_P", connectedAccountRef: "seat1", ...over };
}

function reply(id: string, at: string): ThreadMessageEvent {
  return {
    type: "reply",
    providerEventId: id,
    connectedAccountRef: "seat1",
    fromProfileUrl: "https://www.linkedin.com/in/ACoAA_P",
    fromProviderRef: "ACoAA_P",
    fromPublicIdentifier: null,
    fromName: "Pat",
    body: `reply ${id}`,
    receivedAt: at,
  };
}

function echo(id: string, at: string): ThreadMessageEvent {
  return {
    type: "outbound_echo",
    providerEventId: id,
    connectedAccountRef: "seat1",
    toProfileUrl: "https://www.linkedin.com/in/ACoAA_P",
    fromProviderRef: "ACoAA_P",
    fromPublicIdentifier: null,
    fromName: "Pat",
    body: `typed ${id}`,
    sentAt: at,
  };
}

function setup(candidates: ThreadSyncCandidate[]) {
  const synced: { leadId: string; at: Date }[] = [];
  const limits: number[] = [];
  const store: ThreadSyncStore = {
    listThreadSyncCandidates: async (perAccount) => {
      limits.push(perAccount);
      return candidates;
    },
    markThreadSynced: async (leadId, at) => {
      synced.push({ leadId, at });
    },
  };
  const infra = new InMemoryLinkedInInfra();
  const handled: ThreadMessageEvent[] = [];
  const handleEvent = async (e: ThreadMessageEvent) => {
    handled.push(e);
    return { handled: true, action: e.type === "reply" ? "reply:duplicate" : "echo:mirrored" };
  };
  return { store, infra, handled, synced, limits, handleEvent };
}

describe("runThreadSync — the webhook-independent thread backstop", () => {
  it("replays every settled message of each candidate's thread through the inbound handler, in order", async () => {
    const s = setup([candidate()]);
    s.infra.threads.set("seat1:ACoAA_P", [
      reply("m1", "2026-10-20T10:00:00.000Z"),
      echo("m2", "2026-10-20T11:00:00.000Z"),
    ]);
    const result = await runThreadSync({ store: s.store, linkedinInfra: s.infra, handleEvent: s.handleEvent, now: () => NOW, sleep: async () => {} });

    expect(s.handled.map((e) => e.providerEventId)).toEqual(["m1", "m2"]);
    expect(s.synced).toEqual([{ leadId: "lead1", at: NOW }]);
    expect(result).toMatchObject({ threads: 1, messages: 2, errors: 0 });
    expect(result.outcomes).toEqual({ "reply:duplicate": 1, "echo:mirrored": 1 });
  });

  it("leaves messages still inside the webhook's quiet window to the webhook (no double processing)", async () => {
    const s = setup([candidate()]);
    const fresh = new Date(NOW.getTime() - THREAD_SYNC_QUIET_MS / 2).toISOString();
    s.infra.threads.set("seat1:ACoAA_P", [reply("old", "2026-10-20T10:00:00.000Z"), reply("fresh", fresh)]);
    await runThreadSync({ store: s.store, linkedinInfra: s.infra, handleEvent: s.handleEvent, now: () => NOW, sleep: async () => {} });

    expect(s.handled.map((e) => e.providerEventId)).toEqual(["old"]);
  });

  it("asks the store for a bounded batch per account (rule 04: reads are budgeted)", async () => {
    const s = setup([]);
    await runThreadSync({ store: s.store, linkedinInfra: s.infra, handleEvent: s.handleEvent, now: () => NOW, sleep: async () => {} });
    expect(s.limits).toEqual([THREAD_SYNC_LEADS_PER_ACCOUNT]);
  });

  it("one failing thread never stops the rest, and still rotates to the back of the queue", async () => {
    const s = setup([candidate({ leadId: "bad", attendeeProviderRef: "ACoAA_BAD" }), candidate()]);
    s.infra.threads.set("seat1:ACoAA_P", [reply("m1", "2026-10-20T10:00:00.000Z")]);
    const infra = {
      listThreadMessages: async (req: Parameters<InMemoryLinkedInInfra["listThreadMessages"]>[0]) => {
        if (req.attendeeProviderRef === "ACoAA_BAD") throw new Error("provider 503");
        return s.infra.listThreadMessages(req);
      },
    };
    const result = await runThreadSync({ store: s.store, linkedinInfra: infra, handleEvent: s.handleEvent, now: () => NOW, sleep: async () => {} });

    expect(result.errors).toBe(1);
    expect(s.handled.map((e) => e.providerEventId)).toEqual(["m1"]);
    expect(s.synced.map((x) => x.leadId)).toEqual(["bad", "lead1"]);
  });

  it("paces consecutive thread reads with a human-ish gap", async () => {
    const s = setup([candidate({ leadId: "a" }), candidate({ leadId: "b" }), candidate({ leadId: "c" })]);
    const sleeps: number[] = [];
    await runThreadSync({
      store: s.store,
      linkedinInfra: s.infra,
      handleEvent: s.handleEvent,
      now: () => NOW,
      sleep: async (ms) => {
        sleeps.push(ms);
      },
    });
    expect(sleeps).toHaveLength(2); // between reads, never before the first
  });
});
