import { describe, expect, it, vi } from "vitest";
import { draftCallBrief } from "./brief";
import type { DraftInput } from "../copy/shared";

const input: DraftInput = {
  lead: { firstName: "Sam", lastName: "Lee", title: "VP Ops", companyName: "Acme", industry: "Logistics" },
  insights: { pain_points: ["manual routing"], triggers: ["new funding"], motivations: ["scale"], value_angle: "cut routing time", aha_moment: "auto-routing", summary: "ops leader" },
  context: { cta: "book a 15-min intro", valueProp: "routing software", accountName: "Northwind", accountIndustry: "SaaS", brandVoice: "warm and consultative", guardrails: "never name competitors" },
};

function fakeModel(obj: unknown) {
  return { obj } as never;
}

describe("draftCallBrief", () => {
  it("returns a structured brief with the booking link and no recording note for one-party", async () => {
    const generate = vi.fn(async () => ({
      object: {
        opening_line: "Hi Sam, this is Alex from Acme.",
        talking_points: ["manual routing is costing you"],
        value_angle: "a clearer way to cut routing time, the way other ops teams do once it's automated",
        consequence_hook: "And if routing stays manual another quarter, what does that mean for you?",
        aha_moment: "a 15-minute look at one route — easy to cancel, nothing to prep",
        objection_handling: ["if busy, offer a callback"],
        goal_statement: "book a 15-min intro",
      },
    }));
    const brief = await draftCallBrief(
      { input, bookingLink: "https://cal.com/x", recordingConsentMode: "one_party", personaName: "Alex" },
      fakeModel(null),
      generate as never
    );
    expect(brief.bookingLink).toBe("https://cal.com/x");
    expect(brief.openingLine).toContain("Alex");
    expect(brief.openingLine).not.toMatch(/recorded/i);
    expect(brief.talkingPoints).toEqual(["manual routing is costing you"]);
    expect(brief.valueAngle).toContain("cut routing time");
    expect(brief.consequenceHook).toMatch(/\?$/);
    expect(brief.ahaMoment).toContain("15-minute");
    // brand voice + guardrails + seller company reach the generator's prompt
    for (const fragment of ["warm and consultative", "never name competitors", "Northwind"]) {
      expect(generate).toHaveBeenCalledWith(
        expect.objectContaining({ prompt: expect.stringContaining(fragment) })
      );
    }
  });

  it("flags a fabricated metric in the brief against the lead facts (grounding guardrail)", async () => {
    const generate = vi.fn(async () => ({
      object: {
        opening_line: "Hi Sam, this is Alex from Acme.",
        talking_points: [],
        value_angle: "teams like yours cut routing time 47% in a quarter",
        consequence_hook: "what happens if it stays manual?",
        aha_moment: "a 15-minute look",
        objection_handling: [],
        goal_statement: "book a 15-min intro",
      },
    }));
    const brief = await draftCallBrief(
      { input, bookingLink: "https://cal.com/x", recordingConsentMode: "one_party", personaName: "Alex" },
      fakeModel(null),
      generate as never
    );
    expect(brief.violations.map((v) => v.rule)).toContain("ungrounded-claim");
  });

  it("returns no grounding violations for a clean brief", async () => {
    const generate = vi.fn(async () => ({
      object: {
        opening_line: "Hi Sam, this is Alex from Acme.",
        talking_points: ["manual routing is costing you"],
        value_angle: "a clearer way to cut routing time",
        consequence_hook: "what happens if it stays manual?",
        aha_moment: "a 15-minute look",
        objection_handling: [],
        goal_statement: "book a 15-min intro",
      },
    }));
    const brief = await draftCallBrief(
      { input, bookingLink: "https://cal.com/x", recordingConsentMode: "one_party", personaName: "Alex" },
      fakeModel(null),
      generate as never
    );
    expect(brief.violations).toEqual([]);
  });

  it("prepends a recorded-line disclosure for two-party consent", async () => {
    const generate = vi.fn(async () => ({
      object: {
        opening_line: "Hi Sam, this is Alex from Acme.",
        talking_points: [],
        objection_handling: [],
        goal_statement: "book a 15-min intro",
      },
    }));
    const brief = await draftCallBrief(
      { input, bookingLink: "https://cal.com/x", recordingConsentMode: "two_party", personaName: "Alex" },
      fakeModel(null),
      generate as never
    );
    expect(brief.openingLine).toMatch(/recorded/i);
  });
});
