import { describe, expect, it } from "vitest";
import { MockLanguageModelV2 } from "ai/test";
import { draftEmail, validateEmailDraft } from "./email";
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
  subject: "those 3 SDR roles",
  body: "Saw Acme is hiring three SDRs while pipeline coverage is stretched.\n\nTeams in that spot use our SDR agents to get qualified meetings on the calendar in week one, before new hires ramp.\n\nWorth a 15-minute look?\n\n{{sender_name}}",
};

const SLOPPY = {
  subject: "A Game-Changing Opportunity For You!!",
  body: "I hope this finds you well! I wanted to reach out because our cutting-edge platform is a game-changer.",
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

describe("validateEmailDraft", () => {
  it("accepts a clean draft", () => {
    expect(validateEmailDraft(CLEAN)).toEqual([]);
  });

  it("flags slop, long subjects, and links", () => {
    const violations = validateEmailDraft({
      subject: "you will not believe this one weird trick",
      body: "I hope this finds you well. See https://example.com for more!",
    });
    const rules = violations.map((v) => v.rule);
    expect(rules).toContain("banned-phrase");
    expect(rules).toContain("subject-length");
    expect(rules).toContain("no-links");
  });

  it("flags a metric claim not grounded in the lead facts", () => {
    const violations = validateEmailDraft(
      {
        subject: "growth",
        body: "Saw Acme grew pipeline 40% last quarter. Worth a look?\n\n{{sender_name}}",
      },
      leadBlock(INPUT),
    );
    expect(violations.map((v) => v.rule)).toContain("ungrounded-claim");
  });

  it("does not flag a metric that the lead facts support", () => {
    const grounding = leadBlock({
      ...INPUT,
      insights: { ...INPUT.insights, triggers: ["reported 40% YoY growth"] },
    });
    const violations = validateEmailDraft(
      { subject: "that 40% year", body: "Your 40% growth is usually when this breaks. Worth a look?\n\n{{sender_name}}" },
      grounding,
    );
    expect(violations.map((v) => v.rule)).not.toContain("ungrounded-claim");
  });
});

describe("draftEmail", () => {
  it("returns a clean draft with no violations on the first pass", async () => {
    const model = new MockLanguageModelV2({ doGenerate: textResponse(CLEAN) });

    const draft = await draftEmail(INPUT, model);

    expect(draft.subject).toBe(CLEAN.subject);
    expect(draft.violations).toEqual([]);
    expect(model.doGenerateCalls).toHaveLength(1);
  });

  it("regenerates once when the first draft violates style, feeding back the violations", async () => {
    const model = new MockLanguageModelV2({
      doGenerate: sequence(textResponse(SLOPPY), textResponse(CLEAN)),
    });

    const draft = await draftEmail(INPUT, model);

    expect(model.doGenerateCalls).toHaveLength(2);
    expect(JSON.stringify(model.doGenerateCalls[1]!.prompt)).toContain("banned-phrase");
    expect(draft.violations).toEqual([]);
  });

  it("flags persistent violations instead of hiding them", async () => {
    const model = new MockLanguageModelV2({
      doGenerate: sequence(textResponse(SLOPPY), textResponse(SLOPPY)),
    });

    const draft = await draftEmail(INPUT, model);

    expect(model.doGenerateCalls).toHaveLength(2);
    expect(draft.violations.length).toBeGreaterThan(0);
  });

  it("flags a fabricated metric in the generated draft so it routes to review", async () => {
    const fabricated = {
      subject: "growth",
      body: "Saw Acme grew 40% last quarter. Worth a look?\n\n{{sender_name}}",
    };
    const model = new MockLanguageModelV2({
      doGenerate: sequence(textResponse(fabricated), textResponse(fabricated)),
    });

    const draft = await draftEmail(INPUT, model);

    expect(draft.violations.map((v) => v.rule)).toContain("ungrounded-claim");
  });

  it("sends the lead context (pain points, CTA, aha moment) to the model", async () => {
    const model = new MockLanguageModelV2({ doGenerate: textResponse(CLEAN) });

    await draftEmail(INPUT, model);

    const prompt = JSON.stringify(model.doGenerateCalls[0]!.prompt);
    expect(prompt).toContain("pipeline coverage");
    expect(prompt).toContain("book a 15-min intro");
    expect(prompt).toContain("qualified meetings on the calendar");
  });
});
