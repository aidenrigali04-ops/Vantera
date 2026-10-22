import { describe, expect, it } from "vitest";
import { PLAN_DISPLAY, PLAN_DISPLAY_ORDER } from "@vantera/billing";
import { FAQ_ITEMS } from "./faq-data";

/*
 * The FAQ is static copy (a client component imports it, so it can't pull in the
 * billing package), yet it doubles as FAQPage JSON-LD that search engines quote. These
 * guard the facts it states against the sources that own them.
 */
describe("FAQ_ITEMS", () => {
  it("prices every plan on sale at its billing display price", () => {
    const cost = FAQ_ITEMS.find((i) => i.q === "How much does it cost?");
    expect(cost).toBeDefined();
    for (const tier of PLAN_DISPLAY_ORDER) {
      const plan = PLAN_DISPLAY[tier];
      expect(cost!.a).toContain(plan.name);
      expect(cost!.a).toContain(`$${plan.monthlyUsd}/month`);
    }
  });

  it("answers as autopilot sending, not per-message approval", () => {
    // Answers only: a question may still ask about approval, to answer it.
    const answers = FAQ_ITEMS.map((i) => i.a).join(" ");
    expect(answers).not.toMatch(/approve (each|every)|until you sign off|review is the default/i);
  });
});
