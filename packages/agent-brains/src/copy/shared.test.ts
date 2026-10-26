import { describe, expect, it } from "vitest";
import { exemplarBlock, leadBlock, proofSection, steerBlock, STEER_MAX_CHARS, PROSPECT_ACCURACY_RULE } from "./shared";
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

describe("exemplarBlock — Vera's winning-message memory (Stage 0.5)", () => {
  it("returns empty for absent or empty exemplars (prompt byte-identical without wins)", () => {
    expect(exemplarBlock()).toBe("");
    expect(exemplarBlock([])).toBe("");
    expect(exemplarBlock(["  ", ""])).toBe("");
  });

  it("renders quoted exemplars with guide-not-copy instructions", () => {
    const block = exemplarBlock(["Saw your post on hiring SDRs", "Congrats on the Series B"]);
    expect(block).toContain('"Saw your post on hiring SDRs"');
    expect(block).toContain('"Congrats on the Series B"');
    // the load-bearing instructions: reuse the angle, never its first words/structure, never copy,
    // never borrow claims (copy-quality fix 2026-10-21: "guide for angle and energy" let exemplars
    // clone the template)
    expect(block).toContain("Reuse the angle (what it referenced), never its first words or sentence structure");
    expect(block.toLowerCase()).toContain("do not copy");
    expect(block.toLowerCase()).toContain("numbers");
  });

  it("is prompt-only: a metric inside an exemplar must never whitelist a claim", () => {
    // Grounding stays the leadBlock alone. If a draft borrows "42%" from an exemplar,
    // the anti-hallucination check must still flag it as ungrounded.
    const grounding = leadBlock({
      lead: { firstName: "A", lastName: "B", title: "VP Sales", companyName: "Acme", industry: "SaaS" },
      insights: insights(),
      context: { cta: "a quick intro", accountName: "Vantera" },
    });
    const flagged = findUngroundedClaims("We lifted reply rates 42% for a peer", grounding);
    expect(flagged.length).toBeGreaterThan(0);
  });
});

describe("leadBlock — verified why-now (ML-3)", () => {
  it("renders the captured why-now as a verified line with the reference instruction", () => {
    const block = leadBlock({
      ...base,
      lead: { ...base.lead, whyNow: { kind: "intent", text: "Commented asking for a churn tool on a RevOps post", ageDays: 2 } },
      insights: insights(),
    });
    expect(block).toContain("Why now (verified");
    expect(block).toContain("Commented asking for a churn tool on a RevOps post (2d ago)");
    // the why-now text is grounding: a note citing it never trips the claim check
    expect(findUngroundedClaims("Saw you asked about a churn tool", block)).toEqual([]);
  });

  it("is byte-identical to before when there is no why-now", () => {
    const without = leadBlock({ ...base, insights: insights() });
    const withNull = leadBlock({ ...base, lead: { ...base.lead, whyNow: null }, insights: insights() });
    expect(withNull).toBe(without);
    expect(without).not.toContain("Why now");
  });
});

describe("steerBlock — owner direction (prompt-only)", () => {
  it("returns empty for blank input", () => {
    expect(steerBlock()).toBe("");
    expect(steerBlock(null)).toBe("");
    expect(steerBlock("  \n\t ")).toBe("");
  });

  it("collapses whitespace and newlines to single spaces and trims", () => {
    expect(steerBlock("  warmer\n\n tone,   shorter  ")).toBe(
      "Owner direction (style and angle only — adds no facts, never a claim about the prospect):\nwarmer tone, shorter",
    );
  });

  it("caps the steer at STEER_MAX_CHARS", () => {
    expect(STEER_MAX_CHARS).toBe(280);
    const out = steerBlock("a".repeat(500));
    expect(out.split("\n")[1]).toHaveLength(280);
  });

  it("is prompt-only: a number inside the steer never whitelists a claim", () => {
    const base = { lead: { firstName: "Dana" }, insights: insights(), context: { cta: "intro" } };
    const grounding = leadBlock(base);
    expect(findUngroundedClaims("Acme grew 40% last quarter", grounding).length).toBeGreaterThan(0);
  });
});
