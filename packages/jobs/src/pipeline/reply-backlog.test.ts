import { describe, expect, it, vi } from "vitest";
import { runReplyBacklog, STALE_REPLY_MS, REPLY_LOOKBACK_MS, type ReplyBacklogStore, type StaleReply } from "./reply-backlog";

const NOW = new Date("2026-07-11T00:00:00.000Z");

function makeStore(stale: StaleReply[]) {
  const notifications: Parameters<ReplyBacklogStore["insertLeadNotification"]>[0][] = [];
  const seenArgs: { now: Date; staleMs: number; lookbackMs: number }[] = [];
  const store: ReplyBacklogStore = {
    getStaleUnansweredReplies: async (now, staleMs, lookbackMs) => {
      seenArgs.push({ now, staleMs, lookbackMs });
      return stale;
    },
    insertLeadNotification: async (n) => { notifications.push(n); },
  };
  return { store, notifications, seenArgs };
}

const reply = (leadId: string, over: Partial<StaleReply> = {}): StaleReply => ({
  accountId: "acc1",
  leadId,
  receivedAt: new Date("2026-07-10T00:00:00.000Z"),
  ...over,
});

describe("runReplyBacklog", () => {
  it("escalates each orphaned reply's lead to a needs_human alert", async () => {
    const { store, notifications } = makeStore([reply("lead1"), reply("lead2")]);
    const out = await runReplyBacklog({ store, now: () => NOW });

    expect(out).toEqual({ status: "completed", candidates: 2, escalated: 2 });
    expect(notifications).toHaveLength(2);
    expect(notifications[0]).toMatchObject({ accountId: "acc1", leadId: "lead1", kind: "needs_human" });
    expect(notifications[0]!.body.toLowerCase()).toContain("replied");
  });

  it("raises ONE alert for a lead with several unanswered replies (no pile-up)", async () => {
    const { store, notifications } = makeStore([
      reply("lead1", { receivedAt: new Date("2026-07-10T09:00:00.000Z") }),
      reply("lead1", { receivedAt: new Date("2026-07-10T08:00:00.000Z") }),
    ]);
    const out = await runReplyBacklog({ store, now: () => NOW });

    expect(out.escalated).toBe(1);
    expect(notifications).toHaveLength(1);
    expect(notifications[0]!.leadId).toBe("lead1");
  });

  it("does nothing when there is no backlog (healthy pipeline)", async () => {
    const { store, notifications } = makeStore([]);
    const out = await runReplyBacklog({ store, now: () => NOW });
    expect(out).toEqual({ status: "completed", candidates: 0, escalated: 0 });
    expect(notifications).toHaveLength(0);
  });

  it("queries with the stale + lookback windows", async () => {
    const { store, seenArgs } = makeStore([]);
    await runReplyBacklog({ store, now: () => NOW });
    expect(seenArgs[0]).toEqual({ now: NOW, staleMs: STALE_REPLY_MS, lookbackMs: REPLY_LOOKBACK_MS });
  });
});
