import { describe, expect, it, vi } from "vitest";
import { runCallDispatch, isWithinCallingWindow } from "./call-dispatch";
import { InMemoryVoiceInfra } from "@vantera/voice-infra";
import type { CallDispatchDeps, DispatchableCall } from "./types";

const baseCall: DispatchableCall = {
  id: "s1", accountId: "acc1", campaignId: "camp1", agentId: "a1", leadId: "l1",
  brief: { openingLine: "hi", talkingPoints: [], objectionHandling: [], goalStatement: "book", bookingLink: "https://cal.com/x", violations: [] },
  phone: "+15551112222",
  config: {
    cta: "book", bookingLink: "https://cal.com/x",
    voice: { voiceId: "v1", personaName: "Alex", language: "en-US" },
    recordingConsentMode: "two_party",
    callingWindow: { days: ["mon", "tue", "wed", "thu", "fri"], startLocal: "09:00", endLocal: "17:00" },
    maxAttempts: 3,
  },
  attemptsSoFar: 0,
  leadTimezone: "America/New_York",
};

describe("isWithinCallingWindow", () => {
  it("is true on a weekday at 10am local, false at 8pm", () => {
    const win = baseCall.config.callingWindow;
    // 2026-06-15 is a Monday. 14:00 UTC = 10:00 America/New_York (EDT)
    expect(isWithinCallingWindow(new Date("2026-06-15T14:00:00Z"), "America/New_York", win)).toBe(true);
    // 00:00 UTC Tuesday = 20:00 Monday EDT — outside 09:00–17:00
    expect(isWithinCallingWindow(new Date("2026-06-16T00:00:00Z"), "America/New_York", win)).toBe(false);
  });
});

function deps(infra = new InMemoryVoiceInfra(), over: Partial<CallDispatchDeps["store"]> = {}): CallDispatchDeps {
  const store = {
    getApprovedCalls: vi.fn(async () => [baseCall]),
    isKillSwitchOn: vi.fn(async () => false),
    isSuppressed: vi.fn(async () => false),
    claimSending: vi.fn(async () => true),
    revertToApproved: vi.fn(async () => {}),
    markSuppressed: vi.fn(async () => {}),
    insertCall: vi.fn(async () => {}),
    markSendSent: vi.fn(async () => {}),
    ...over,
  } as unknown as CallDispatchDeps["store"];
  return { store, voiceInfra: infra, fromNumber: "+15550000000", now: () => new Date("2026-06-15T14:00:00Z") };
}

describe("runCallDispatch", () => {
  it("dials an approved call inside the window and records the call row", async () => {
    const infra = new InMemoryVoiceInfra();
    const d = deps(infra);
    const res = await runCallDispatch(d);
    expect(res).toContainEqual({ sendId: "s1", outcome: "dialing" });
    expect(infra.placedCalls).toHaveLength(1);
    expect(d.store.insertCall).toHaveBeenCalled();
    expect(d.store.markSendSent).toHaveBeenCalledWith("s1");
  });

  it("re-checks suppression at the send boundary and never dials a suppressed phone", async () => {
    const infra = new InMemoryVoiceInfra();
    const d = deps(infra, { isSuppressed: vi.fn(async () => true) });
    const res = await runCallDispatch(d);
    expect(infra.placedCalls).toHaveLength(0);
    expect(d.store.markSuppressed).toHaveBeenCalledWith("s1");
    expect(res).toContainEqual({ sendId: "s1", outcome: "suppressed" });
  });

  it("defers calls outside the calling window without claiming them", async () => {
    const infra = new InMemoryVoiceInfra();
    const d = deps(infra);
    d.now = () => new Date("2026-06-16T00:00:00Z"); // 8pm Monday EDT
    const res = await runCallDispatch(d);
    expect(infra.placedCalls).toHaveLength(0);
    expect(d.store.claimSending).not.toHaveBeenCalled();
    expect(res).toContainEqual({ sendId: "s1", outcome: "outside_window" });
  });

  it("halts entirely when the kill switch is on", async () => {
    const d = deps(new InMemoryVoiceInfra(), { isKillSwitchOn: vi.fn(async () => true) });
    const res = await runCallDispatch(d);
    expect(res).toEqual([{ sendId: "*", outcome: "halted" }]);
  });

  it("returns no_caller_number and claims nothing when fromNumber is blank", async () => {
    const infra = new InMemoryVoiceInfra();
    const d = deps(infra);
    d.fromNumber = "   ";
    const claim = vi.spyOn(d.store, "claimSending");
    const res = await runCallDispatch(d);
    expect(res).toEqual([{ sendId: "*", outcome: "no_caller_number" }]);
    expect(claim).not.toHaveBeenCalled();
  });

  it("reverts the send and returns failed when placeCall throws", async () => {
    const infra = new InMemoryVoiceInfra();
    const d = deps(infra);
    // ensure we're inside the calling window (Mon 10am EDT = 14:00 UTC — already the default now)
    d.now = () => new Date("2026-06-15T14:00:00Z");
    const revert = vi.spyOn(d.store, "revertToApproved");
    vi.spyOn(infra, "placeCall").mockRejectedValue(new Error("provider 500"));
    const res = await runCallDispatch(d);
    expect(res[0]!.outcome).toBe("failed");
    expect(revert).toHaveBeenCalledWith("s1");
  });
});
