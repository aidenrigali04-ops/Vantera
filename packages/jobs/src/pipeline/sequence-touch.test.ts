import { describe, expect, it, vi } from "vitest";
import { runSequenceTouch } from "./sequence-touch";
import type { SequenceTouchDeps, SequenceTouchDispatch } from "./types";

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

function deps(
  over: Partial<SequenceTouchDeps["store"]> = {},
  refreshResult: "ok" | "dropped" = "ok",
  refreshedLeadIds: string[] = []
): SequenceTouchDeps & { stoppedRunIds: string[] } {
  const stoppedRunIds: string[] = [];
  return {
    stoppedRunIds,
    store: {
      getDraftableLead: async () => lead,
      getCampaignCta: async () => "Book a 15-min call",
      isSuppressed: async () => false,
      insertScheduledSend: vi.fn(async () => {}),
      stopSequenceRun: vi.fn(async (runId: string) => { stoppedRunIds.push(runId); }),
      ...over,
    },
    draftLinkedInFn: async () =>
      ({ connectionNote: "hey there", followupMessage: "f", violations: [] } as never),
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
  it("drafts a LinkedIn message touch and records channel linkedin", async () => {
    const d = deps();
    const out = await runSequenceTouch(dispatch, d);
    expect(out).toBe("drafted");
    expect(d.store.insertScheduledSend).toHaveBeenCalledWith(
      expect.objectContaining({ channel: "linkedin", linkedinStage: "message" })
    );
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
