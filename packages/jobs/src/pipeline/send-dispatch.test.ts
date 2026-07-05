import { describe, expect, it } from "vitest";
import { INVITE_EXPIRY_DAYS, MIN_LEAD_MESSAGE_GAP_MS, runSendDispatch } from "./send-dispatch";
import { TRIAL_SEND_CAP } from "./types";
import type { DispatchSender, DispatchableSend, SendDispatchDeps, SendDispatchStore } from "./types";

// ─── helper ──────────────────────────────────────────────────────────────────

function makeSend(overrides: Partial<DispatchableSend> = {}): DispatchableSend {
  return {
    id: "send1",
    accountId: "acc1",
    campaignId: "camp1",
    leadId: "lead1",
    channel: "linkedin",
    linkedinStage: "invite",
    status: "approved",
    createdAt: new Date("2026-06-01T00:00:00Z"),
    accountPaused: false,
    campaignStatus: "active",
    leadInvitedAt: null,
    leadConnectedAt: null,
    leadAssignedSenderId: null,
    subscriptionStatus: "active",
    leadLastMessageSentAt: null,
    leadRepliedAt: null,
    ...overrides,
  };
}

function makeSender(over: Partial<DispatchSender> = {}): DispatchSender {
  return {
    linkedinAccountId: "li1",
    ageDays: 30,
    sentToday: 0,
    last7d: 0,
    sentTodayMessages: 0,
    lastAssignedAt: 0,
    healthy: true,
    ...over,
  };
}

class FakeDispatchStore implements SendDispatchStore {
  killSwitch = false;
  sends: DispatchableSend[] = [];
  /** the tenant's connected senders; default = one mature, idle account (single-sender case) */
  senders: DispatchSender[] = [makeSender()];
  accountSendsCount = 0; // what countAccountSends reports (trial-cap input)
  scheduled: { sendId: string; scheduledFor: Date }[] = [];
  canceled: { sendId: string; error: string }[] = [];
  assigned: { leadId: string; linkedinAccountId: string }[] = [];
  getDispatchableSendsCallCount = 0;

  async isKillSwitchOn() {
    return this.killSwitch;
  }
  async countAccountSends(_accountId: string) {
    return this.accountSendsCount;
  }
  async getDispatchableSends(_staleCutoff: Date) {
    this.getDispatchableSendsCallCount += 1;
    return this.sends;
  }
  async listSenderCandidates(_accountId: string, _now: Date) {
    return this.senders;
  }
  async assignLeadSender(leadId: string, linkedinAccountId: string) {
    this.assigned.push({ leadId, linkedinAccountId });
  }
  async markScheduled(sendId: string, scheduledFor: Date) {
    this.scheduled.push({ sendId, scheduledFor });
  }
  async cancelSend(sendId: string, error: string) {
    this.canceled.push({ sendId, error });
  }
}

function makeDeps(store: FakeDispatchStore, enqueued: { sendId: string; runAt: Date }[] = []): SendDispatchDeps {
  return {
    store,
    enqueue: async (sendId, runAt) => {
      enqueued.push({ sendId, runAt });
    },
    now: () => new Date("2026-06-12T10:00:00Z"),
  };
}

// ─── tests ───────────────────────────────────────────────────────────────────

describe("runSendDispatch — kill switch", () => {
  it("kill switch on → status 'halted', nothing enqueued, getDispatchableSends never called", async () => {
    const store = new FakeDispatchStore();
    store.killSwitch = true;
    store.sends = [makeSend()];
    const enqueued: { sendId: string; runAt: Date }[] = [];
    const deps = makeDeps(store, enqueued);

    const result = await runSendDispatch(deps);

    expect(result).toEqual({ status: "halted", scheduled: 0, canceled: 0, skipped: 0 });
    expect(enqueued).toHaveLength(0);
    expect(store.scheduled).toHaveLength(0);
    expect(store.getDispatchableSendsCallCount).toBe(0);
  });
});

describe("runSendDispatch — account / campaign gating", () => {
  it("paused account rows all skipped, none enqueued", async () => {
    const store = new FakeDispatchStore();
    store.sends = [
      makeSend({ id: "s1", accountPaused: true }),
      makeSend({ id: "s2", accountPaused: true }),
    ];
    const enqueued: { sendId: string; runAt: Date }[] = [];
    const deps = makeDeps(store, enqueued);

    const result = await runSendDispatch(deps);

    expect(result.status).toBe("completed");
    expect(result.skipped).toBe(2);
    expect(result.scheduled).toBe(0);
    expect(enqueued).toHaveLength(0);
  });

  it("inactive campaign rows skipped", async () => {
    const store = new FakeDispatchStore();
    store.sends = [makeSend({ id: "s1", campaignStatus: "paused" })];
    const enqueued: { sendId: string; runAt: Date }[] = [];
    const deps = makeDeps(store, enqueued);

    const result = await runSendDispatch(deps);

    expect(result.skipped).toBe(1);
    expect(result.scheduled).toBe(0);
    expect(enqueued).toHaveLength(0);
  });
});

describe("runSendDispatch — linkedin channel", () => {
  it("no active LinkedIn identity → all skipped", async () => {
    const store = new FakeDispatchStore();
    store.senders = [];
    store.sends = [
      makeSend({ id: "s1", channel: "linkedin", linkedinStage: "invite" }),
      makeSend({ id: "s2", channel: "linkedin", linkedinStage: "invite" }),
    ];
    const enqueued: { sendId: string; runAt: Date }[] = [];
    const deps = makeDeps(store, enqueued);

    const result = await runSendDispatch(deps);

    expect(result.skipped).toBe(2);
    expect(result.scheduled).toBe(0);
    expect(enqueued).toHaveLength(0);
  });

  it("invite ramp budget respected (ageDays 3 → budget 5 minus countSentToday) and message budget independent", async () => {
    const store = new FakeDispatchStore();
    // ageDays 3 → ramp bucket maxAgeDays 7 → daily invite ceiling = 5
    // budget = 5 - 3 = 2 invites remaining; message budget = 25 - 0 = 25
    store.senders = [makeSender({ ageDays: 3, sentToday: 3, sentTodayMessages: 0 })];

    store.sends = [
      makeSend({ id: "inv1", channel: "linkedin", linkedinStage: "invite" }),
      makeSend({ id: "inv2", channel: "linkedin", linkedinStage: "invite" }),
      makeSend({ id: "inv3", channel: "linkedin", linkedinStage: "invite" }), // over budget
      // a message row — should be scheduled independently (lead is connected)
      makeSend({ id: "msg1", channel: "linkedin", linkedinStage: "message", leadConnectedAt: new Date("2026-06-01T00:00:00Z") }),
    ];
    const enqueued: { sendId: string; runAt: Date }[] = [];
    const deps = makeDeps(store, enqueued);

    const result = await runSendDispatch(deps);

    // 2 invites (budget) + 1 message = 3 scheduled; 1 invite skipped
    expect(result.scheduled).toBe(3);
    expect(result.skipped).toBe(1);
    expect(enqueued.map((e) => e.sendId)).toContain("msg1");
    expect(enqueued.filter((e) => e.sendId.startsWith("inv")).map((e) => e.sendId)).toHaveLength(2);
  });

  it("message rows parked (skipped) while lead not connected and invite fresh", async () => {
    const store = new FakeDispatchStore();
    store.senders = [makeSender()];
    const now = new Date("2026-06-12T10:00:00Z");
    // invited 5 days ago — well within expiry window
    const recentInvite = new Date(now.getTime() - 5 * 86_400_000);

    store.sends = [
      makeSend({
        id: "msg1",
        channel: "linkedin",
        linkedinStage: "message",
        leadInvitedAt: recentInvite,
        leadConnectedAt: null, // not accepted yet
      }),
    ];
    const enqueued: { sendId: string; runAt: Date }[] = [];
    const deps = makeDeps(store, enqueued);

    const result = await runSendDispatch(deps);

    expect(result.skipped).toBe(1);
    expect(result.scheduled).toBe(0);
    expect(store.canceled).toHaveLength(0);
  });

  it("message rows canceled with /expired/ error when invitedAt > 30 days ago and not connected", async () => {
    const store = new FakeDispatchStore();
    store.senders = [makeSender()];
    const now = new Date("2026-06-12T10:00:00Z");
    // invited 31 days ago — expired
    const oldInvite = new Date(now.getTime() - (INVITE_EXPIRY_DAYS + 1) * 86_400_000);

    store.sends = [
      makeSend({
        id: "msg1",
        channel: "linkedin",
        linkedinStage: "message",
        leadInvitedAt: oldInvite,
        leadConnectedAt: null,
      }),
    ];
    const enqueued: { sendId: string; runAt: Date }[] = [];
    const deps = makeDeps(store, enqueued);

    const result = await runSendDispatch(deps);

    expect(result.canceled).toBe(1);
    expect(result.scheduled).toBe(0);
    expect(store.canceled[0]?.error).toMatch(/expired/);
  });

  it("invite rows for already-invited leads skipped", async () => {
    const store = new FakeDispatchStore();
    store.senders = [makeSender()];

    store.sends = [
      makeSend({
        id: "inv1",
        channel: "linkedin",
        linkedinStage: "invite",
        leadInvitedAt: new Date("2026-06-10T10:00:00Z"), // already invited
      }),
    ];
    const enqueued: { sendId: string; runAt: Date }[] = [];
    const deps = makeDeps(store, enqueued);

    const result = await runSendDispatch(deps);

    expect(result.skipped).toBe(1);
    expect(result.scheduled).toBe(0);
  });
});

describe("runSendDispatch — trial send cap", () => {
  it("trialing account at the send ceiling: all rows skipped, nothing enqueued", async () => {
    const store = new FakeDispatchStore();
    store.accountSendsCount = TRIAL_SEND_CAP; // already at the lifetime trial ceiling
    store.sends = [
      makeSend({ id: "s1", subscriptionStatus: "trialing" }),
      makeSend({ id: "s2", subscriptionStatus: "trialing" }),
    ];
    const enqueued: { sendId: string; runAt: Date }[] = [];
    const deps = makeDeps(store, enqueued);

    const result = await runSendDispatch(deps);

    expect(result.scheduled).toBe(0);
    expect(result.skipped).toBe(2);
    expect(enqueued).toHaveLength(0);
  });

  it("trialing account with 1 send of headroom schedules exactly one, skips the rest", async () => {
    const store = new FakeDispatchStore();
    store.accountSendsCount = TRIAL_SEND_CAP - 1; // one send of trial budget left
    store.sends = [
      makeSend({ id: "s1", subscriptionStatus: "trialing" }),
      makeSend({ id: "s2", subscriptionStatus: "trialing" }),
      makeSend({ id: "s3", subscriptionStatus: "trialing" }),
    ];
    const enqueued: { sendId: string; runAt: Date }[] = [];
    const deps = makeDeps(store, enqueued);

    const result = await runSendDispatch(deps);

    expect(result.scheduled).toBe(1);
    expect(result.skipped).toBe(2);
    expect(enqueued).toHaveLength(1);
  });

  it("paid account is never bounded by the trial send cap", async () => {
    const store = new FakeDispatchStore();
    store.accountSendsCount = TRIAL_SEND_CAP * 100; // far over — but not on trial
    store.sends = [
      makeSend({ id: "s1", subscriptionStatus: "active" }),
      makeSend({ id: "s2", subscriptionStatus: "active" }),
    ];
    const enqueued: { sendId: string; runAt: Date }[] = [];
    const deps = makeDeps(store, enqueued);

    const result = await runSendDispatch(deps);

    expect(result.scheduled).toBe(2);
    expect(result.skipped).toBe(0);
  });
});

describe("runSendDispatch — scheduling and timing", () => {
  it("scheduled times strictly increasing and all > now", async () => {
    const store = new FakeDispatchStore();
    store.sends = [
      makeSend({ id: "s1" }),
      makeSend({ id: "s2" }),
      makeSend({ id: "s3" }),
    ];
    const enqueued: { sendId: string; runAt: Date }[] = [];
    const now = new Date("2026-06-12T10:00:00Z");
    const deps: SendDispatchDeps = {
      store,
      enqueue: async (sendId, runAt) => { enqueued.push({ sendId, runAt }); },
      now: () => now,
    };

    await runSendDispatch(deps);

    expect(enqueued).toHaveLength(3);
    for (const e of enqueued) {
      expect(e.runAt.getTime()).toBeGreaterThan(now.getTime());
    }
    // strictly increasing
    const times = enqueued.map((e) => e.runAt.getTime());
    for (let i = 1; i < times.length; i++) {
      expect(times[i]!).toBeGreaterThan(times[i - 1]!);
    }
  });

  it("stale 'scheduled' rows are re-dispatched like approved ones", async () => {
    const store = new FakeDispatchStore();
    // The store returns this stale scheduled row (it was already fetched as dispatchable by the store)
    store.sends = [
      makeSend({ id: "stale1", status: "scheduled" }),
    ];
    const enqueued: { sendId: string; runAt: Date }[] = [];
    const deps = makeDeps(store, enqueued);

    const result = await runSendDispatch(deps);

    expect(result.scheduled).toBe(1);
    expect(enqueued[0]?.sendId).toBe("stale1");
  });
});

describe("runSendDispatch — rolling weekly invite ceiling", () => {
  it("clamps invites to the rolling weekly ceiling (97 sent in 7 days → at most 3 dispatched)", async () => {
    const store = new FakeDispatchStore();
    store.senders = [makeSender({ ageDays: 60, sentToday: 0, last7d: 97 })];
    store.sends = Array.from({ length: 10 }, (_, i) =>
      makeSend({ id: `inv${i + 1}`, channel: "linkedin", linkedinStage: "invite" })
    );
    const enqueued: { sendId: string; runAt: Date }[] = [];
    const deps = makeDeps(store, enqueued);
    const result = await runSendDispatch(deps);
    expect(result.scheduled).toBe(3);
    expect(result.skipped).toBe(7);
    expect(enqueued).toHaveLength(3);
  });

  it("weekly ceiling fully consumed → zero invites dispatched", async () => {
    const store = new FakeDispatchStore();
    store.senders = [makeSender({ ageDays: 60, sentToday: 0, last7d: 100 })];
    store.sends = [
      makeSend({ id: "inv1", channel: "linkedin", linkedinStage: "invite" }),
      makeSend({ id: "inv2", channel: "linkedin", linkedinStage: "invite" }),
    ];
    const enqueued: { sendId: string; runAt: Date }[] = [];
    const deps = makeDeps(store, enqueued);
    const result = await runSendDispatch(deps);
    expect(result.scheduled).toBe(0);
    expect(result.skipped).toBe(2);
    expect(enqueued).toHaveLength(0);
  });

  it("weekly ceiling does NOT restrict messages — only invites", async () => {
    const store = new FakeDispatchStore();
    store.senders = [makeSender({ ageDays: 60, last7d: 100, sentTodayMessages: 0 })];
    store.sends = [
      makeSend({ id: "inv1", channel: "linkedin", linkedinStage: "invite" }),
      makeSend({
        id: "msg1",
        channel: "linkedin",
        linkedinStage: "message",
        leadConnectedAt: new Date("2026-06-01T00:00:00Z"),
      }),
    ];
    const enqueued: { sendId: string; runAt: Date }[] = [];
    const deps = makeDeps(store, enqueued);
    const result = await runSendDispatch(deps);
    expect(result.scheduled).toBe(1);
    expect(enqueued[0]?.sendId).toBe("msg1");
    expect(result.skipped).toBe(1);
  });
});

describe("runSendDispatch — multi-sender distribution", () => {
  function inviteRows(n: number): DispatchableSend[] {
    return Array.from({ length: n }, (_, i) =>
      makeSend({ id: `inv${i + 1}`, leadId: `lead${i + 1}`, linkedinStage: "invite" })
    );
  }

  it("spreads invites evenly across two healthy senders", async () => {
    const store = new FakeDispatchStore();
    store.senders = [
      makeSender({ linkedinAccountId: "A", ageDays: 60 }),
      makeSender({ linkedinAccountId: "B", ageDays: 60 }),
    ];
    store.sends = inviteRows(10);
    const deps = makeDeps(store);

    const result = await runSendDispatch(deps);

    expect(result.scheduled).toBe(10);
    const toA = store.assigned.filter((a) => a.linkedinAccountId === "A").length;
    const toB = store.assigned.filter((a) => a.linkedinAccountId === "B").length;
    expect(toA).toBe(5);
    expect(toB).toBe(5);
  });

  it("total capacity is the SUM across senders, not a single account's cap", async () => {
    const store = new FakeDispatchStore();
    // two mature accounts → 20 + 20 = 40 invite capacity; 30 requested all go out
    store.senders = [
      makeSender({ linkedinAccountId: "A", ageDays: 60 }),
      makeSender({ linkedinAccountId: "B", ageDays: 60 }),
    ];
    store.sends = inviteRows(30);
    const deps = makeDeps(store);

    const result = await runSendDispatch(deps);

    expect(result.scheduled).toBe(30); // > one account's 20/day ceiling
    expect(store.assigned.filter((a) => a.linkedinAccountId === "A").length).toBe(15);
    expect(store.assigned.filter((a) => a.linkedinAccountId === "B").length).toBe(15);
  });

  it("a sender at its daily cap sends nothing; the other absorbs within its own cap", async () => {
    const store = new FakeDispatchStore();
    store.senders = [
      makeSender({ linkedinAccountId: "full", ageDays: 60, sentToday: 20 }), // budget 0
      makeSender({ linkedinAccountId: "open", ageDays: 60, sentToday: 0 }), // budget 20
    ];
    store.sends = inviteRows(5);
    const deps = makeDeps(store);

    const result = await runSendDispatch(deps);

    expect(result.scheduled).toBe(5);
    expect(store.assigned.every((a) => a.linkedinAccountId === "open")).toBe(true);
  });

  it("persists the sticky sender assignment on the lead at first invite", async () => {
    const store = new FakeDispatchStore();
    store.senders = [makeSender({ linkedinAccountId: "li1" })];
    store.sends = [makeSend({ id: "inv1", leadId: "leadX", linkedinStage: "invite" })];
    const deps = makeDeps(store);

    await runSendDispatch(deps);

    expect(store.assigned).toEqual([{ leadId: "leadX", linkedinAccountId: "li1" }]);
  });

  it("a connected lead's message draws only from its assigned sender's message budget", async () => {
    const store = new FakeDispatchStore();
    store.senders = [
      makeSender({ linkedinAccountId: "A", sentTodayMessages: 0 }), // budget 25
      makeSender({ linkedinAccountId: "B", sentTodayMessages: 25 }), // budget 0
    ];
    store.sends = [
      makeSend({
        id: "msgB",
        leadId: "leadB",
        linkedinStage: "message",
        leadAssignedSenderId: "B", // locked to B, which is out of message budget
        leadConnectedAt: new Date("2026-06-01T00:00:00Z"),
      }),
    ];
    const deps = makeDeps(store);

    const result = await runSendDispatch(deps);

    // locked to B (budget 0) — does NOT borrow A's budget
    expect(result.scheduled).toBe(0);
    expect(result.skipped).toBe(1);
  });

  it("a message locked to an unhealthy/unavailable sender is skipped, never re-routed", async () => {
    const store = new FakeDispatchStore();
    store.senders = [
      makeSender({ linkedinAccountId: "A", healthy: true }),
      makeSender({ linkedinAccountId: "B", healthy: false }), // the assigned one went unhealthy
    ];
    store.sends = [
      makeSend({
        id: "msgB",
        leadId: "leadB",
        linkedinStage: "message",
        leadAssignedSenderId: "B",
        leadConnectedAt: new Date("2026-06-01T00:00:00Z"),
      }),
    ];
    const deps = makeDeps(store);

    const result = await runSendDispatch(deps);

    expect(result.scheduled).toBe(0);
    expect(result.skipped).toBe(1);
  });
});

// ─── per-lead message gating (backlog can never burst a prospect) ────────────

describe("runSendDispatch — per-lead message gating", () => {
  const NOW = new Date("2026-07-04T12:00:00Z");
  const connected = new Date("2026-07-04T10:00:00Z");

  it("cancels stale duplicate messages for a lead and schedules only the newest", async () => {
    const store = new FakeDispatchStore();
    store.sends = [
      makeSend({
        id: "old1", linkedinStage: "message", leadConnectedAt: connected,
        leadAssignedSenderId: "li1", createdAt: new Date("2026-06-30T08:10:00Z"),
      }),
      makeSend({
        id: "old2", linkedinStage: "message", leadConnectedAt: connected,
        leadAssignedSenderId: "li1", createdAt: new Date("2026-06-30T08:15:00Z"),
      }),
      makeSend({
        id: "newest", linkedinStage: "message", leadConnectedAt: connected,
        leadAssignedSenderId: "li1", createdAt: new Date("2026-07-04T09:00:00Z"),
      }),
    ];
    const deps = { ...makeDeps(store), now: () => NOW };

    const result = await runSendDispatch(deps);

    expect(result.scheduled).toBe(1);
    expect(result.canceled).toBe(2);
    expect(store.scheduled.map((s) => s.sendId)).toEqual(["newest"]);
    expect(store.canceled.map((c) => c.sendId).sort()).toEqual(["old1", "old2"]);
  });

  it("parks a proactive message when the last delivered message is inside the per-lead gap", async () => {
    const store = new FakeDispatchStore();
    store.sends = [
      makeSend({
        id: "s1", linkedinStage: "message", leadConnectedAt: connected,
        leadAssignedSenderId: "li1",
        leadLastMessageSentAt: new Date(NOW.getTime() - MIN_LEAD_MESSAGE_GAP_MS / 2),
      }),
    ];
    const deps = { ...makeDeps(store), now: () => NOW };

    const result = await runSendDispatch(deps);

    expect(result.scheduled).toBe(0);
    expect(result.skipped).toBe(1);
  });

  it("lets a reply-answering message through the gap (the lead's reply resets the clock)", async () => {
    const store = new FakeDispatchStore();
    const lastSent = new Date(NOW.getTime() - 30 * 60_000);
    store.sends = [
      makeSend({
        id: "reply1", linkedinStage: "message", leadConnectedAt: connected,
        leadAssignedSenderId: "li1",
        leadLastMessageSentAt: lastSent,
        leadRepliedAt: new Date(lastSent.getTime() + 5 * 60_000), // they replied after our message
      }),
    ];
    const deps = { ...makeDeps(store), now: () => NOW };

    const result = await runSendDispatch(deps);

    expect(result.scheduled).toBe(1);
    expect(store.scheduled.map((s) => s.sendId)).toEqual(["reply1"]);
  });

  it("dispatches a proactive message once the delivered gap has fully elapsed", async () => {
    const store = new FakeDispatchStore();
    store.sends = [
      makeSend({
        id: "s1", linkedinStage: "message", leadConnectedAt: connected,
        leadAssignedSenderId: "li1",
        leadLastMessageSentAt: new Date(NOW.getTime() - MIN_LEAD_MESSAGE_GAP_MS - 60_000),
      }),
    ];
    const deps = { ...makeDeps(store), now: () => NOW };

    const result = await runSendDispatch(deps);

    expect(result.scheduled).toBe(1);
  });
});
