import { describe, expect, it } from "vitest";
import { MockLanguageModelV2 } from "ai/test";
import { draftLinkedIn, validateLinkedInDraft, CONNECTION_NOTE_MAX_CHARS } from "./linkedin";
import { leadBlock, type DraftInput } from "./shared";

const INPUT: DraftInput = {
  lead: { firstName: "Dana", title: "VP Sales", companyName: "Acme", industry: "saas" },
  insights: {
    pain_points: ["pipeline coverage"],
    triggers: ["hiring 3 SDRs"],
    motivations: ["hit growth targets"],
    value_angle: "fills top-of-funnel without headcount",
    aha_moment: "qualified meetings on the calendar in week one",
    summary: "Strong fit.",
  },
  context: { cta: "book a 15-min intro", valueProp: "SDR agents that source and outreach" },
};

const CLEAN = {
  connection_note:
    "Dana — noticed Acme is hiring three SDRs at once. Scaling outbound that fast is a ride; happy to swap notes from the builder side.",
  followup_message:
    "Thanks for connecting. When teams hire SDRs in batches, pipeline usually outruns ramp time. We put agents on sourcing so meetings land while new reps train. Open to a 15-min look?",
};

function textResponse(json: unknown) {
  return {
    finishReason: "stop" as const,
    usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
    content: [{ type: "text" as const, text: JSON.stringify(json) }],
    warnings: [],
  };
}

function sequence(...responses: ReturnType<typeof textResponse>[]) {
  let call = 0;
  return async () => responses[Math.min(call++, responses.length - 1)]!;
}

describe("validateLinkedInDraft", () => {
  it("generates connection notes to the 200-char free-tier cap (locked) so a reviewed note is sent verbatim, never truncated", () => {
    expect(CONNECTION_NOTE_MAX_CHARS).toBe(200);
  });

  it("accepts a clean draft", () => {
    expect(validateLinkedInDraft(CLEAN)).toEqual([]);
  });

  it("enforces the connection-note char ceiling", () => {
    const violations = validateLinkedInDraft({
      connection_note: "x".repeat(CONNECTION_NOTE_MAX_CHARS + 1),
      followup_message: "fine",
    });
    expect(violations.some((v) => v.rule === "length")).toBe(true);
  });

  it("rejects links in the connection note", () => {
    const violations = validateLinkedInDraft({
      connection_note: "Check https://example.com",
      followup_message: "fine",
    });
    expect(violations.some((v) => v.rule === "no-links")).toBe(true);
  });

  it("flags a metric claim not grounded in the lead facts", () => {
    const violations = validateLinkedInDraft(
      {
        connection_note: "Dana — saw Acme grew 40% last quarter, impressive.",
        followup_message: "Thanks for connecting. Worth a quick look?",
      },
      leadBlock(INPUT),
    );
    expect(violations.map((v) => v.rule)).toContain("ungrounded-claim");
  });
});

describe("draftLinkedIn", () => {
  it("returns both messages with no violations for clean output", async () => {
    const model = new MockLanguageModelV2({ doGenerate: textResponse(CLEAN) });

    const draft = await draftLinkedIn(INPUT, model);

    expect(draft.connectionNote).toBe(CLEAN.connection_note);
    expect(draft.followupMessage).toBe(CLEAN.followup_message);
    expect(draft.violations).toEqual([]);
  });

  it("regenerates once on style violations", async () => {
    const sloppy = {
      connection_note: "I hope this finds you well! Big fan of Acme!",
      followup_message: CLEAN.followup_message,
    };
    const model = new MockLanguageModelV2({
      doGenerate: sequence(textResponse(sloppy), textResponse(CLEAN)),
    });

    const draft = await draftLinkedIn(INPUT, model);

    expect(model.doGenerateCalls).toHaveLength(2);
    expect(draft.violations).toEqual([]);
  });
});
