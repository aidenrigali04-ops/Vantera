import { describe, expect, it, vi } from "vitest";
import { INVITE_EXPIRY_DAYS, STALE_TASK_MINUTES, runSendDispatch } from "./send-dispatch";
import { TRIAL_SEND_CAP } from "./types";
import type { DispatchableSend, SendDispatchDeps, SendDispatchStore } from "./types";

// ─── helper ──────────────────────────────────────────────────────────────────

function makeSend(overrides: Partial<DispatchableSend> = {}): DispatchableSend {
  return {
    id: "send1",
    accountId: "acc1",
    campaignId: "camp1",
    leadId: "lead1",
    channel: "email",
    linkedinStage: null,
    status: "approved",
    accountPaused: false,
    hasSenderAddress: true,
    campaignStatus: "active",
    leadInvitedAt: null,
    leadConnectedAt: null,
    subscriptionStatus: "active",
    ...overrides,
  };
}

class FakeDispatchStore implements SendDispatchStore {
  killSwitch = false;
  sends: DispatchableSend[] = [];
  emailCapacity = 10;
  linkedInAgeDays: number | null = 30;
  inviteSentToday = 0;
  messageSentToday = 0;
  invitesLast7Days = 0; // what countLinkedInInvitesLast7Days reports (weekly-ceiling input)
  accountSendsCount = 0; // what countAccountSends reports (trial-cap input)
  scheduled: { sendId: string; scheduledFor: Date }[] = [];
  canceled: { sendId: string; error: string }[] = [];
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
  async getEmailCapacity(_accountId: string, _dayStart: Date) {
    return this.emailCapacity;
  }
  async getLinkedInAccountAgeDays(_accountId: string, _now: Date) {
    return this.linkedInAgeDays;
  }
  async countLinkedInSentToday(_accountId: string, kind: "invite" | "message", _dayStart: Date) {
    return kind === "invite" ? this.inviteSentToday : this.messageSentToday;
  }
  async countLinkedInInvitesLast7Days(_accountId: string, _now: Date) {
    return this.invitesLast7Days;
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

describe("runSendDispatch — email channel", () => {
  it("email without sender address skipped", async () => {
    const store = new FakeDispatchStore();
    store.sends = [makeSend({ channel: "email", hasSenderAddress: false })];
    const enqueued: { sendId: string; runAt: Date }[] = [];
    const deps = makeDeps(store, enqueued);

    const result = await runSendDispatch(deps);

    expect(result.skipped).toBe(1);
    expect(result.scheduled).toBe(0);
    expect(enqueued).toHaveLength(0);
  });

  it("email scheduled up to capacity (capacity 2, 3 rows → scheduled 2 skipped 1)", async () => {
    const store = new FakeDispatchStore();
    store.emailCapacity = 2;
    store.sends = [
      makeSend({ id: "s1" }),
      makeSend({ id: "s2" }),
      makeSend({ id: "s3" }),
    ];
    const enqueued: { sendId: string; runAt: Date }[] = [];
    const deps = makeDeps(store, enqueued);

    const result = await runSendDispatch(deps);

    expect(result.scheduled).toBe(2);
    expect(result.skipped).toBe(1);
    expect(enqueued).toHaveLength(2);
  });
});

describe("runSendDispatch — linkedin channel", () => {
  it("no active LinkedIn identity → all skipped", async () => {
    const store = new FakeDispatchStore();
    store.linkedInAgeDays = null;
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
    store.linkedInAgeDays = 3;
    store.inviteSentToday = 3; // budget = 5 - 3 = 2 remaining
    store.messageSentToday = 0; // message budget = 25 - 0 = 25

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
    store.linkedInAgeDays = 30;
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
    store.linkedInAgeDays = 30;
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

  it("mixed account: email rows scheduled (capacity available), linkedin rows skipped (no active identity), counters exact", async () => {
    const store = new FakeDispatchStore();
    store.linkedInAgeDays = null; // no connected LinkedIn identity
    store.emailCapacity = 10;
    store.sends = [
      makeSend({ id: "email1", channel: "email" }),
      makeSend({ id: "email2", channel: "email" }),
      makeSend({ id: "li1", channel: "linkedin", linkedinStage: "invite" }),
      makeSend({ id: "li2", channel: "linkedin", linkedinStage: "invite" }),
    ];
    const enqueued: { sendId: string; runAt: Date }[] = [];
    const deps = makeDeps(store, enqueued);

    const result = await runSendDispatch(deps);

    // Email rows should be scheduled (capacity available, sender address present)
    expect(result.scheduled).toBe(2);
    // LinkedIn rows skipped because no active identity
    expect(result.skipped).toBe(2);
    expect(result.canceled).toBe(0);
    expect(result.status).toBe("completed");
    // Only email rows enqueued
    const enqueuedIds = enqueued.map((e) => e.sendId);
    expect(enqueuedIds).toContain("email1");
    expect(enqueuedIds).toContain("email2");
    expect(enqueuedIds).not.toContain("li1");
    expect(enqueuedIds).not.toContain("li2");
  });

  it("invite rows for already-invited leads skipped", async () => {
    const store = new FakeDispatchStore();
    store.linkedInAgeDays = 30;

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
    store.emailCapacity = 10;
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
    store.emailCapacity = 10; // channel capacity is not the limiter here
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
    store.emailCapacity = 10;
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
    store.emailCapacity = 10;
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
    store.emailCapacity = 10;
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
    // ageDays 60 → steady-state daily allowance = LINKEDIN_STEADY_DAILY_INVITES (20)
    // but 97 of the 100 weekly slots are consumed → only 3 remain
    store.linkedInAgeDays = 60;
    store.inviteSentToday = 0;       // daily counter is not the binding constraint
    store.invitesLast7Days = 97;     // weekly counter: 100 - 97 = 3 remaining

    // 10 queued invite rows; assert at most 3 dispatched
    store.sends = Array.from({ length: 10 }, (_, i) =>
      makeSend({ id: `inv${i + 1}`, channel: "linkedin", linkedinStage: "invite" })
    );
    const enqueued: { sendId: string; runAt: Date }[] = [];
    const deps = makeDeps(store, enqueued);

    const result = await runSendDispatch(deps);

    // Weekly ceiling wins: exactly 3 invites dispatched, 7 skipped
    expect(result.scheduled).toBe(3);
    expect(result.skipped).toBe(7);
    expect(enqueued).toHaveLength(3);
  });

  it("weekly ceiling fully consumed → zero invites dispatched", async () => {
    const store = new FakeDispatchStore();
    store.linkedInAgeDays = 60;
    store.inviteSentToday = 0;
    store.invitesLast7Days = 100; // at the ceiling

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
    store.linkedInAgeDays = 60;
    store.invitesLast7Days = 100; // invite ceiling fully consumed
    store.messageSentToday = 0;   // messages have room

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

    // invite blocked (weekly ceiling), message goes through
    expect(result.scheduled).toBe(1);
    expect(enqueued[0]?.sendId).toBe("msg1");
    expect(result.skipped).toBe(1);
  });
});
