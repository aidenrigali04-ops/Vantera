import { describe, expect, it, vi } from "vitest";
import { InMemoryLinkedInInfra } from "@vantera/linkedin-infra";
import { runLifecycleOutreach, buildLifecycleReplyAlert } from "./lifecycle-outreach";
import type { LifecycleConfig, LifecycleDueTouch, LifecycleStore } from "./types";

// Wednesday 15:00 UTC = 11:00 in New York — inside the Mon–Fri 08:00–16:59 window
const IN_WINDOW = new Date("2026-07-08T15:00:00.000Z");
// Saturday
const WEEKEND = new Date("2026-07-11T15:00:00.000Z");

const config = (over: Partial<LifecycleConfig> = {}): LifecycleConfig => ({
  enabled: true,
  senderRef: "unipile:founder",
  dailyCap: 10,
  senderLocation: "New York",
  notifyEmail: "founder@example.com",
  lastRunAt: null,
  ...over,
});

const touch = (over: Partial<LifecycleDueTouch> = {}): LifecycleDueTouch => ({
  id: "t1",
  userId: "u1",
  accountId: "a1",
  segment: "trial_lapsed",
  touchNumber: 1,
  linkedinUrl: "https://www.linkedin.com/in/sara",
  displayName: "Sara Bright",
  stalledStep: null,
  inviteSent: false,
  connected: false,
  leadCount: 42,
  qualifiedCount: 11,
  ...over,
});

function makeStore(over: Partial<Record<keyof LifecycleStore, unknown>> = {}) {
  const store = {
    getLifecycleConfig: vi.fn(async () => config()),
    setLifecycleLastRun: vi.fn(async () => {}),
    isKillSwitchOn: vi.fn(async () => false),
    getSenderRow: vi.fn(async () => ({ accountId: "ops", status: "active", connectedAt: new Date("2026-01-01") })),
    getAccountOwnerEmails: vi.fn(async () => ["aiden@vanterasystem.com"]),
    scanStalledOnboarding: vi.fn(async () => []),
    scanIdleAfterOnboarding: vi.fn(async () => []),
    scanTrialLapsedBackfill: vi.fn(async () => []),
    enqueueTouch: vi.fn(async () => {}),
    enqueueDueFollowUps: vi.fn(async () => 0),
    getDueTouches: vi.fn(async () => [] as LifecycleDueTouch[]),
    markTouchSent: vi.fn(async () => {}),
    markTouchInvited: vi.fn(async () => {}),
    markTouchFailed: vi.fn(async () => {}),
    markTouchSkipped: vi.fn(async () => {}),
    recordLifecycleReply: vi.fn(async () => null),
    recordLifecycleAcceptance: vi.fn(async () => false),
    enqueueTrialLapsedForAccounts: vi.fn(async () => 0),
    ...over,
  };
  return store as unknown as LifecycleStore & typeof store;
}

function makeDeps(store = makeStore(), now = IN_WINDOW) {
  const linkedin = new InMemoryLinkedInInfra();
  const sent: { to: string; subject: string }[] = [];
  const pauses: number[] = [];
  return {
    deps: {
      store,
      linkedin,
      send: async (a: { to: string; subject: string; html: string; text: string }) => {
        sent.push({ to: a.to, subject: a.subject });
      },
      pause: async (ms: number) => {
        pauses.push(ms);
      },
      now: () => now,
    },
    linkedin,
    sent,
    pauses,
  };
}

describe("runLifecycleOutreach gates", () => {
  it("no-ops when disabled or the sender ref is unset", async () => {
    const store = makeStore({ getLifecycleConfig: vi.fn(async () => config({ enabled: false })) });
    const { deps } = makeDeps(store);
    expect((await runLifecycleOutreach(deps)).reason).toBe("disabled");
    expect(store.scanStalledOnboarding).not.toHaveBeenCalled();
  });

  it("respects the platform kill switch", async () => {
    const store = makeStore({ isKillSwitchOn: vi.fn(async () => true) });
    const { deps } = makeDeps(store);
    expect((await runLifecycleOutreach(deps)).reason).toBe("kill_switch");
  });

  it("waits for the founder's business-hours window", async () => {
    const { deps } = makeDeps(makeStore(), WEEKEND);
    expect((await runLifecycleOutreach(deps)).reason).toBe("outside_window");
  });

  it("runs at most once a day (20h gate)", async () => {
    const store = makeStore({
      getLifecycleConfig: vi.fn(async () =>
        config({ lastRunAt: new Date(IN_WINDOW.getTime() - 3_600_000) })
      ),
    });
    const { deps } = makeDeps(store);
    expect((await runLifecycleOutreach(deps)).reason).toBe("already_ran");
  });

  it("admin pin: refuses a sender that is not under the aiden@vanterasystem.com account", async () => {
    const store = makeStore({
      getAccountOwnerEmails: vi.fn(async () => ["someone-else@example.com"]),
      getDueTouches: vi.fn(async () => [touch({ connected: true })]),
    });
    const { deps, linkedin } = makeDeps(store);
    const summary = await runLifecycleOutreach(deps);
    expect(summary.reason).toBe("sender_not_admin");
    expect(linkedin.sentMessages).toHaveLength(0);
    expect(linkedin.sentInvites).toHaveLength(0);
    expect(store.scanStalledOnboarding).not.toHaveBeenCalled();
  });

  it("aborts + alerts the founder when the sender connection is not active", async () => {
    const store = makeStore({
      getSenderRow: vi.fn(async () => ({ accountId: "ops", status: "disconnected", connectedAt: null })),
    });
    const { deps, sent } = makeDeps(store);
    const summary = await runLifecycleOutreach(deps);
    expect(summary.reason).toBe("sender_unavailable");
    expect(sent).toHaveLength(1);
    expect(store.setLifecycleLastRun).toHaveBeenCalled(); // the run gate is also the alert throttle
  });
});

describe("runLifecycleOutreach sending", () => {
  it("scans all three segments excluding the ops workspace, then enqueues", async () => {
    const store = makeStore({
      scanStalledOnboarding: vi.fn(async () => [
        { userId: "u9", accountId: "a9", displayName: null, linkedinUrl: null, stalledStep: "your website" },
      ]),
    });
    const { deps } = makeDeps(store);
    const summary = await runLifecycleOutreach(deps);
    expect(store.scanStalledOnboarding).toHaveBeenCalledWith(IN_WINDOW, "ops");
    expect(store.enqueueTouch).toHaveBeenCalledTimes(1);
    expect(summary.enqueued).toBe(1);
  });

  it("DMs an already-connected target with merged founder copy and marks it sent", async () => {
    const store = makeStore({ getDueTouches: vi.fn(async () => [touch({ connected: true })]) });
    const { deps, linkedin } = makeDeps(store);
    const summary = await runLifecycleOutreach(deps);
    expect(summary.messagesSent).toBe(1);
    expect(linkedin.sentMessages).toHaveLength(1);
    expect(linkedin.sentMessages[0]!.connectedAccountId).toBe("unipile:founder");
    expect(linkedin.sentMessages[0]!.body).toContain("42");
    expect(store.markTouchSent).toHaveBeenCalled();
  });

  it("invite gate: a non-connection gets one note-less invite, not a message", async () => {
    const store = makeStore({ getDueTouches: vi.fn(async () => [touch()]) });
    const { deps, linkedin } = makeDeps(store); // fake getConnectionState → connected: false
    const summary = await runLifecycleOutreach(deps);
    expect(summary.invitesSent).toBe(1);
    expect(linkedin.sentInvites).toHaveLength(1);
    expect(linkedin.sentMessages).toHaveLength(0);
    expect(store.markTouchInvited).toHaveBeenCalled();
  });

  it("skips (forever) a touch with no LinkedIn URL — LinkedIn-only, no email fallback", async () => {
    const store = makeStore({ getDueTouches: vi.fn(async () => [touch({ linkedinUrl: null })]) });
    const { deps, linkedin } = makeDeps(store);
    const summary = await runLifecycleOutreach(deps);
    expect(summary.skipped).toBe(1);
    expect(store.markTouchSkipped).toHaveBeenCalledWith("t1");
    expect(linkedin.sentInvites).toHaveLength(0);
  });

  it("a send failure marks the touch failed and the run continues", async () => {
    const store = makeStore({
      getDueTouches: vi.fn(async () => [touch({ id: "bad", connected: true }), touch({ id: "ok", connected: true, userId: "u2" })]),
    });
    const { deps, linkedin } = makeDeps(store);
    const original = linkedin.sendMessage.bind(linkedin);
    let first = true;
    linkedin.sendMessage = async (req) => {
      if (first) {
        first = false;
        throw new Error("provider 500");
      }
      return original(req);
    };
    const summary = await runLifecycleOutreach(deps);
    expect(summary.failed).toBe(1);
    expect(summary.messagesSent).toBe(1);
    expect(store.markTouchFailed).toHaveBeenCalledWith("bad", "provider 500");
  });

  it("clamps the requested cap through the rule-04 message ceiling", async () => {
    const store = makeStore({
      getLifecycleConfig: vi.fn(async () => config({ dailyCap: 500 })),
    });
    const { deps } = makeDeps(store);
    await runLifecycleOutreach(deps);
    // LINKEDIN_STEADY_DAILY_MESSAGES = 25 — a misconfigured cap can never exceed it
    expect(store.getDueTouches).toHaveBeenCalledWith(IN_WINDOW, 25);
  });

  it("paces between sends but not before the first", async () => {
    const store = makeStore({
      getDueTouches: vi.fn(async () => [
        touch({ id: "t1", connected: true }),
        touch({ id: "t2", userId: "u2", connected: true }),
      ]),
    });
    const { deps, pauses } = makeDeps(store);
    await runLifecycleOutreach(deps);
    expect(pauses).toHaveLength(1);
    expect(pauses[0]!).toBeGreaterThanOrEqual(84_000); // 120s ± 30%
    expect(pauses[0]!).toBeLessThanOrEqual(156_000);
  });

  it("stamps the run gate after a completed run", async () => {
    const store = makeStore();
    const { deps } = makeDeps(store);
    await runLifecycleOutreach(deps);
    expect(store.setLifecycleLastRun).toHaveBeenCalledWith(IN_WINDOW);
  });
});

describe("alert builders", () => {
  it("reply alert carries the sender name and body, escaped", () => {
    const a = buildLifecycleReplyAlert("f@x.com", "Sara <b>", "hi & thanks");
    expect(a.to).toBe("f@x.com");
    expect(a.html).toContain("&lt;b&gt;");
    expect(a.text).toContain("hi & thanks");
  });
});
