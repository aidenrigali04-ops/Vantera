import { describe, expect, it, vi } from "vitest";
import { draftCallBrief } from "./brief";
import type { DraftInput } from "../copy/shared";

const input: DraftInput = {
  lead: { firstName: "Sam", lastName: "Lee", title: "VP Ops", companyName: "Acme", industry: "Logistics" },
  insights: { pain_points: ["manual routing"], triggers: ["new funding"], motivations: ["scale"], value_angle: "cut routing time", aha_moment: "auto-routing", summary: "ops leader" },
  context: { cta: "book a 15-min intro", valueProp: "routing software", accountIndustry: "SaaS" },
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
