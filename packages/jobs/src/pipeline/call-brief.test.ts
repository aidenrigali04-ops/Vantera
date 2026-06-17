import { describe, expect, it, vi } from "vitest";
import { runCallBrief, normalizePhone } from "./call-brief";
import type { CallBriefDeps, CallableLead, CallerContext } from "./types";

const ctx: CallerContext = {
  agent: {
    id: "a1", accountId: "acc1", status: "live", campaignId: "camp1",
    config: {
      cta: "book a 15-min intro", bookingLink: "https://cal.com/x",
      voice: { voiceId: "v1", personaName: "Alex", language: "en-US" },
      recordingConsentMode: "two_party",
      callingWindow: { days: ["mon"], startLocal: "09:00", endLocal: "17:00" },
      maxAttempts: 3,
    },
  },
  assets: [],
  account: { name: "Northwind", industry: "SaaS", websiteScan: { summary: "routing software" } },
};

const lead: CallableLead = {
  id: "l1", firstName: "Sam", lastName: "Lee", title: "VP", companyName: "Acme",
  industry: "Logistics", phone: "+15551112222", phoneStatus: "valid",
  aiInsights: { pain_points: ["x"], triggers: [], motivations: [], value_angle: "v", aha_moment: "a", summary: "s" },
};

function deps(over: Partial<CallBriefDeps["store"]> = {}): CallBriefDeps {
  const inserted: unknown[] = [];
  const store = {
    getCallerContext: vi.fn(async () => ctx),
    getCallableLeads: vi.fn(async () => [lead]),
    isSuppressed: vi.fn(async () => false),
    ensureCampaignLead: vi.fn(async () => {}),
    setCampaignLeadStatus: vi.fn(async () => {}),
    insertScheduledSend: vi.fn(async (s) => { inserted.push(s); }),
    setLeadStatus: vi.fn(async () => {}),
    ...over,
  } as unknown as CallBriefDeps["store"];
  (store as unknown as { inserted: unknown[] }).inserted = inserted;
  return {
    store,
    draftBriefFn: vi.fn(async () => ({
      openingLine: "Hi Sam", talkingPoints: [], objectionHandling: [],
      goalStatement: "book", bookingLink: "https://cal.com/x", violations: [],
    })),
  };
}

describe("normalizePhone", () => {
  it("lowercases and strips spaces (E.164 stays valid)", () => {
    expect(normalizePhone(" +1 555 111 2222 ")).toBe("+15551112222");
  });
});

describe("runCallBrief", () => {
  it("drafts a pending_review call send for a valid-phone lead", async () => {
    const d = deps();
    const res = await runCallBrief({ callerAgentId: "a1", accountId: "acc1", leadIds: ["l1"] }, d);
    expect(res).toMatchObject({ status: "completed", drafted: 1, suppressed: 0 });
    const inserted = (d.store as unknown as { inserted: { channel: string; status: string; brief: unknown }[] }).inserted;
    const first = inserted[0]!;
    expect(first).toMatchObject({ channel: "call", status: "pending_review" });
    expect(first.brief).toBeTruthy();
  });

  it("never drafts for a suppressed phone (rule 11)", async () => {
    const d = deps({ isSuppressed: vi.fn(async () => true) });
    const res = await runCallBrief({ callerAgentId: "a1", accountId: "acc1", leadIds: ["l1"] }, d);
    expect(res.drafted).toBe(0);
    expect(res.suppressed).toBe(1);
    expect(d.draftBriefFn).not.toHaveBeenCalled();
  });

  it("skips leads without a valid phone", async () => {
    const d = deps({ getCallableLeads: vi.fn(async () => [{ ...lead, phoneStatus: "unvalidated" as const }]) });
    const res = await runCallBrief({ callerAgentId: "a1", accountId: "acc1", leadIds: ["l1"] }, d);
    expect(res.drafted).toBe(0);
    expect(res.skipped).toBe(1);
  });

  it("skips when the agent is not live", async () => {
    const d = deps({ getCallerContext: vi.fn(async () => ({ ...ctx, agent: { ...ctx.agent, status: "paused" } })) });
    const res = await runCallBrief({ callerAgentId: "a1", accountId: "acc1", leadIds: ["l1"] }, d);
    expect(res.status).toBe("skipped");
  });
});
