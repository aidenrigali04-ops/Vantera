import { describe, expect, it } from "vitest";
import { leadBlock, proofSection, PROSPECT_ACCURACY_RULE } from "./shared";
import { findUngroundedClaims } from "./humanizer";
import type { StoredInsights } from "../prospect/schema";

const insights = (over: Partial<StoredInsights> = {}): StoredInsights => ({
  pain_points: ["pipeline coverage"],
  triggers: ["hiring SDRs"],
  motivations: ["growth"],
  value_angle: "fills funnel without headcount",
  aha_moment: "meetings in week one",
  summary: "fit",
  ...over,
});

const base = {
  lead: { firstName: "Tejas", lastName: "C", title: "I help founders get 10-20 inbound leads/month, no cold DMs", companyName: "ConnectSafely.ai", industry: "lead gen" },
  context: { cta: "a quick intro", accountName: "Vantera" },
};

describe("leadBlock — prospect grounding", () => {
  it("surfaces prospect_offering as a distinct, seller-free 'What they do' line", () => {
    const block = leadBlock({
      ...base,
      insights: insights({ prospect_offering: "runs a service that gets clients 10-20 inbound LinkedIn leads a month" }),
    });
    expect(block).toContain("What they do");
    expect(block).toContain("gets clients 10-20 inbound LinkedIn leads");
    // the prospect's own headline is always present too, so the copy brain can self-correct
    expect(block).toContain("no cold DMs");
  });

  it("omits the 'What they do' line for leads ranked before the field existed (undefined)", () => {
    const block = leadBlock({ ...base, insights: insights({ prospect_offering: undefined }) });
    expect(block).not.toContain("What they do");
    // value angle still present — the accuracy rule tells the brain to trust the title over it
    expect(block).toContain("Value angle:");
  });
});

describe("proof grounding (0046)", () => {
  it("renders proof/pricing/faq facts into the block, with FAQ carrying its question", () => {
    const block = leadBlock({
      ...base,
      insights: insights(),
      context: {
        ...base.context,
        proofPoints: [
          { kind: "metric", text: "42% average show rate on booked calls" },
          { kind: "pricing", text: "starts at $2k/mo, usually $2-4k by volume" },
          { kind: "faq", question: "do you train on my emails?", text: "no, we learn your voice on a call and write each message by hand" },
        ],
      },
    });
    expect(block).toContain("Proof you may cite");
    expect(block).toContain("42% average show rate");
    expect(block).toContain('if they ask "do you train on my emails?"');
  });

  it("makes a cited proof metric pass the anti-hallucination guard (the whole point)", () => {
    const withProof = leadBlock({ ...base, insights: insights(), context: { ...base.context, proofPoints: [{ kind: "metric", text: "42% average show rate" }] } });
    const withoutProof = leadBlock({ ...base, insights: insights(), context: base.context });
    const msg = "Show rates run about 42% since we only message in-market people. Worth a look?";
    // grounded by the proof point → clean; no proof point → the same claim is flagged
    expect(findUngroundedClaims(msg, withProof).some((v) => v.rule === "ungrounded-claim")).toBe(false);
    expect(findUngroundedClaims(msg, withoutProof).some((v) => v.rule === "ungrounded-claim")).toBe(true);
  });

  it("proofSection returns null when there are no usable facts", () => {
    expect(proofSection([])).toBeNull();
    expect(proofSection([{ kind: "metric", text: "   " }])).toBeNull();
    expect(proofSection(undefined)).toBeNull();
  });
});

describe("PROSPECT_ACCURACY_RULE", () => {
  it("forbids restating the prospect's business through the seller's offer and flipping direction", () => {
    expect(PROSPECT_ACCURACY_RULE).toMatch(/never.*flip.*direction/i);
    expect(PROSPECT_ACCURACY_RULE).toMatch(/trust their title/i);
  });
});
