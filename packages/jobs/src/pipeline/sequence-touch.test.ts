import { describe, expect, it, vi } from "vitest";
import { runSequenceTouch } from "./sequence-touch";
import type { SequenceTouchDeps, SequenceTouchDispatch } from "./types";

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
};

function deps(over: Partial<SequenceTouchDeps["store"]> = {}): SequenceTouchDeps {
  return {
    store: {
      getDraftableLead: async () => lead,
      getCampaignCta: async () => "Book a 15-min call",
      isSuppressed: async () => false,
      insertScheduledSend: vi.fn(async () => {}),
      ...over,
    },
    draftEmailFn: async () => ({ subject: "Hi", body: "hello", styleFlags: null } as never),
    draftLinkedInFn: async () => ({ body: "hey there", styleFlags: null } as never),
  };
}

const dispatch: SequenceTouchDispatch = {
  runId: "r1",
  accountId: "a1",
  campaignId: "c1",
  leadId: "l1",
  stage: "imessage",
  touchNo: 1,
};

describe("runSequenceTouch", () => {
  it("drafts an iMessage touch via the short-form drafter and records channel imessage", async () => {
    const d = deps();
    const out = await runSequenceTouch(dispatch, d);
    expect(out).toBe("drafted");
    expect(d.store.insertScheduledSend).toHaveBeenCalledWith(
      expect.objectContaining({ channel: "imessage" })
    );
  });

  it("never drafts when the channel value is suppressed", async () => {
    const insert = vi.fn(async () => {});
    const d = deps({ isSuppressed: async () => true, insertScheduledSend: insert });
    const out = await runSequenceTouch(dispatch, d);
    expect(out).toBe("suppressed");
    expect(insert).not.toHaveBeenCalled();
  });

  it("skips when the lead has no value for the channel", async () => {
    const d = deps({ getDraftableLead: async () => ({ ...lead, email: null }) });
    const out = await runSequenceTouch({ ...dispatch, stage: "email" }, d);
    expect(out).toBe("skipped");
  });
});
