import { describe, expect, it, vi } from "vitest";
import { runSequenceTouch } from "./sequence-touch";
import type { ResponderBundle, SequenceTouchDeps, SequenceTouchDispatch } from "./types";

const NOW = new Date("2026-06-15T00:00:00Z");

const lead = {
  id: "l1",
  firstName: "Sam",
  lastName: "Lee",
  title: "VP",
  companyName: "Acme",
  industry: "saas",
  email: "sam@acme.com",
  linkedinUrl: "https://linkedin.com/in/sam",
  phone: "+15555550100",
  aiInsights: null,
  scoredAt: null as Date | null,
};

const bundle = (over: Partial<ResponderBundle> = {}): ResponderBundle => ({
  campaignId: "c1",
  sendMode: "automatic",
  lead: { firstName: "Sam", lastName: "Lee", title: "VP", companyName: "Acme", industry: "saas" },
  insights: {
    pain_points: ["pipeline coverage"],
    triggers: ["hiring SDRs"],
    motivations: ["growth"],
    value_angle: "fills funnel without headcount",
    aha_moment: "meetings in week one",
    summary: "fit",
  },
  context: { cta: "Book a 15-min call" },
  // a prior agent message in the thread — the follow-up must build on it, not restart
  thread: [{ role: "agent", text: "Thanks for connecting, Sam." }],
  agentTurns: 1,
  hasUnsentMessage: false,
  ...over,
});

function deps(
  over: Partial<SequenceTouchDeps["store"]> = {},
  refreshResult: "ok" | "dropped" = "ok",
  refreshedLeadIds: string[] = [],
  draftFollowupFn: SequenceTouchDeps["draftFollowupFn"] = vi.fn(async () => ({
    message: "Building on our chat — teams your size see meetings in week one. Worth a quick look?",
    violations: [],
  }))
): SequenceTouchDeps & { stoppedRunIds: string[]; draftFollowupFn: SequenceTouchDeps["draftFollowupFn"] } {
  const stoppedRunIds: string[] = [];
  return {
    stoppedRunIds,
    store: {
      getDraftableLead: async () => lead,
      getResponderBundle: async () => bundle(),
      isSuppressed: async () => false,
      insertScheduledSend: vi.fn(async () => {}),
      stopSequenceRun: vi.fn(async (runId: string) => { stoppedRunIds.push(runId); }),
      ...over,
    },
    draftFollowupFn,
    now: () => NOW,
    refreshLead: async (_accountId, leadId) => {
      refreshedLeadIds.push(leadId);
      return refreshResult;
    },
  };
}

const dispatch: SequenceTouchDispatch = {
  runId: "r1",
  accountId: "a1",
  campaignId: "c1",
  leadId: "l1",
  stage: "linkedin",
  touchNo: 1,
};

describe("runSequenceTouch", () => {
  it("drafts a conversation-aware follow-up (body = the brain's message, not the connection note)", async () => {
    const d = deps();
    const out = await runSequenceTouch(dispatch, d);
    expect(out).toBe("drafted");
    expect(d.store.insertScheduledSend).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: "linkedin",
        linkedinStage: "message",
        status: "approved", // automatic mode + clean draft
        body: "Building on our chat — teams your size see meetings in week one. Worth a quick look?",
      })
    );
  });

  it("feeds the running thread to the brain and does NOT pass an incoming message (proactive follow-up)", async () => {
    let captured: Parameters<SequenceTouchDeps["draftFollowupFn"]>[0] | undefined;
    const draftFn: SequenceTouchDeps["draftFollowupFn"] = vi.fn(async (input) => {
      captured = input;
      return { message: "next nudge", violations: [] };
    });
    const d = deps({}, "ok", [], draftFn);
    await runSequenceTouch(dispatch, d);
    expect(captured?.thread).toEqual([{ role: "agent", text: "Thanks for connecting, Sam." }]);
    expect(captured?.incoming).toBeUndefined();
  });

  it("queues for review when the agent is in review mode", async () => {
    const insert = vi.fn(async () => {});
    const d = deps({ getResponderBundle: async () => bundle({ sendMode: "review" }), insertScheduledSend: insert });
    await runSequenceTouch(dispatch, d);
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ status: "pending_review" }));
  });

  it("forces review on a style-flagged draft even in automatic mode", async () => {
    const insert = vi.fn(async () => {});
    const draftFn = vi.fn(async () => ({ message: "salesy", violations: [{ rule: "buzzword", detail: "game-changer" }] }));
    const d = deps({ insertScheduledSend: insert }, "ok", [], draftFn);
    await runSequenceTouch(dispatch, d);
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ status: "pending_review", styleFlags: expect.any(String) })
    );
  });

  it("skips when there is no conversation context (no live Outreach agent / no insights)", async () => {
    const insert = vi.fn(async () => {});
    const d = deps({ getResponderBundle: async () => null, insertScheduledSend: insert });
    const out = await runSequenceTouch(dispatch, d);
    expect(out).toBe("skipped");
    expect(insert).not.toHaveBeenCalled();
  });

  it("never drafts when the LinkedIn profile is suppressed", async () => {
    const insert = vi.fn(async () => {});
    const d = deps({ isSuppressed: async () => true, insertScheduledSend: insert });
    const out = await runSequenceTouch(dispatch, d);
    expect(out).toBe("suppressed");
    expect(insert).not.toHaveBeenCalled();
  });

  it("skips when the lead has no LinkedIn URL", async () => {
    const d = deps({ getDraftableLead: async () => ({ ...lead, linkedinUrl: null }) });
    const out = await runSequenceTouch(dispatch, d);
    expect(out).toBe("skipped");
  });
});

describe("runSequenceTouch — refresh-on-release", () => {
  const agedScoredAt = new Date("2026-05-01T00:00:00Z"); // ~45 days before NOW
  const freshScoredAt = new Date("2026-06-13T00:00:00Z"); // ~2 days before NOW

  it("calls refreshLead for an aged lead and drafts when refresh returns ok — does not stop the run", async () => {
    const insert = vi.fn(async () => {});
    const refreshedLeadIds: string[] = [];
    const d = deps(
      { getDraftableLead: async () => ({ ...lead, scoredAt: agedScoredAt }), insertScheduledSend: insert },
      "ok",
      refreshedLeadIds
    );
    const out = await runSequenceTouch(dispatch, d);
    expect(refreshedLeadIds).toContain("l1");
    expect(out).toBe("drafted");
    expect(d.stoppedRunIds).toHaveLength(0);
  });

  it("returns 'dropped' for an aged lead when refresh returns dropped — stops the run, no draft", async () => {
    const insert = vi.fn(async () => {});
    const refreshedLeadIds: string[] = [];
    const d = deps(
      { getDraftableLead: async () => ({ ...lead, scoredAt: agedScoredAt }), insertScheduledSend: insert },
      "dropped",
      refreshedLeadIds
    );
    const out = await runSequenceTouch(dispatch, d);
    expect(out).toBe("dropped");
    expect(insert).not.toHaveBeenCalled();
    expect(d.stoppedRunIds).toContain(dispatch.runId);
  });

  it("does NOT call refreshLead for a fresh lead", async () => {
    const refreshedLeadIds: string[] = [];
    const d = deps(
      { getDraftableLead: async () => ({ ...lead, scoredAt: freshScoredAt }) },
      "ok",
      refreshedLeadIds
    );
    await runSequenceTouch(dispatch, d);
    expect(refreshedLeadIds).toHaveLength(0);
  });
});
