import { describe, expect, it } from "vitest";
import { MockLanguageModelV3 } from "ai/test";
import { LINKEDIN_SYSTEM, CONNECTION_NOTE_MAX_CHARS, leadIdentity } from "./linkedin";
import { draftLinkedInNote, validateLinkedInNote, linkedinNoteSchema, LINKEDIN_NOTE_SYSTEM } from "./linkedin-note";
import { PROSPECT_ACCURACY_RULE, VOICE_RULES, leadBlock, type DraftInput } from "./shared";

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
const WHY = { kind: "intent", text: "Commented asking for a churn tool on a RevOps post", ageDays: 2 };
const CITES = "Dana, saw your comment about churn tools, curious what you picked.";
const IGNORES = "Dana, always good to meet other sales leaders here.";
const ID = leadIdentity(INPUT.lead);

function textResponse(json: unknown) {
  return {
    finishReason: { unified: "stop" as const, raw: "stop" },
    usage: { inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 1, text: 1, reasoning: 0 } },
    content: [{ type: "text" as const, text: JSON.stringify(json) }],
    warnings: [],
  };
}
function sequence(...responses: ReturnType<typeof textResponse>[]) {
  let call = 0;
  return async () => responses[Math.min(call++, responses.length - 1)]!;
}

describe("validateLinkedInNote", () => {
  it("accepts a clean note that cites the why-now", () => {
    expect(validateLinkedInNote(CITES, null, WHY, ID)).toEqual([]);
  });
  it("enforces the 200-char ceiling", () => {
    const vs = validateLinkedInNote("x".repeat(CONNECTION_NOTE_MAX_CHARS + 1), null, null, ID);
    expect(vs.some((v) => v.rule === "length" && v.part === "invite")).toBe(true);
  });
  it("requires the verified why-now to be cited", () => {
    expect(validateLinkedInNote(IGNORES, null, WHY, ID).some((v) => v.rule === "why-now-missing")).toBe(true);
    expect(validateLinkedInNote(IGNORES, null, null, ID).some((v) => v.rule === "why-now-missing")).toBe(false);
  });
  it("rejects links", () => {
    expect(validateLinkedInNote("Dana, see https://example.com", null, null, ID).some((v) => v.rule === "no-links")).toBe(true);
  });
  it("flags ungrounded metric claims against the grounding block", () => {
    const vs = validateLinkedInNote("Dana, Acme grew 340% last year, impressive.", leadBlock(INPUT), null, ID);
    expect(vs.length).toBeGreaterThan(0);
  });
});

describe("LINKEDIN_NOTE_SYSTEM", () => {
  const noteRules = LINKEDIN_SYSTEM.text.slice(
    LINKEDIN_SYSTEM.text.indexOf("Connection note, under"),
    LINKEDIN_SYSTEM.text.indexOf("Follow-up message:"),
  ).trim();

  it("copies the pair prompt's connection-note rules verbatim, plus accuracy and voice rules", () => {
    expect(noteRules.length).toBeGreaterThan(100);
    expect(LINKEDIN_NOTE_SYSTEM.text).toContain(noteRules);
    expect(LINKEDIN_NOTE_SYSTEM.text).toContain(PROSPECT_ACCURACY_RULE);
    expect(LINKEDIN_NOTE_SYSTEM.text).toContain(VOICE_RULES);
  });
  it("is a distinct prompt and leaves the pair prompt untouched", () => {
    expect(LINKEDIN_NOTE_SYSTEM.text).not.toBe(LINKEDIN_SYSTEM.text);
    expect(LINKEDIN_NOTE_SYSTEM.hash).not.toBe(LINKEDIN_SYSTEM.hash);
    expect(LINKEDIN_SYSTEM.text).toContain("Follow-up message:");
    expect(LINKEDIN_NOTE_SYSTEM.text).not.toContain("Follow-up message:");
  });
  it("asks only for the note", () => {
    expect(Object.keys(linkedinNoteSchema.shape)).toEqual(["connection_note"]);
  });
});

describe("draftLinkedInNote", () => {
  it("returns a clean note in one call", async () => {
    const model = new MockLanguageModelV3({ doGenerate: sequence(textResponse({ connection_note: CITES })) });
    const out = await draftLinkedInNote({ ...INPUT, lead: { ...INPUT.lead, whyNow: WHY } }, model);
    expect(model.doGenerateCalls).toHaveLength(1);
    expect(out).toEqual({ connectionNote: CITES, violations: [] });
  });
  it("regenerates once when the first note ignores the why-now", async () => {
    const model = new MockLanguageModelV3({
      doGenerate: sequence(textResponse({ connection_note: IGNORES }), textResponse({ connection_note: CITES })),
    });
    const out = await draftLinkedInNote({ ...INPUT, lead: { ...INPUT.lead, whyNow: WHY } }, model);
    expect(model.doGenerateCalls).toHaveLength(2);
    expect(out.connectionNote).toBe(CITES);
    expect(out.violations).toEqual([]);
  });
  it("surfaces unresolved violations instead of shipping silently", async () => {
    const model = new MockLanguageModelV3({ doGenerate: sequence(textResponse({ connection_note: IGNORES })) });
    const out = await draftLinkedInNote({ ...INPUT, lead: { ...INPUT.lead, whyNow: WHY } }, model);
    expect(out.violations.some((v) => v.rule === "why-now-missing")).toBe(true);
  });
});
