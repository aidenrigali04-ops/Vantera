import { describe, expect, it } from "vitest";
import { findUngroundedClaims, findUngroundedEntities } from "./humanizer";

// The 11x failure: a bot stated specific facts the prospect data never supported (fake
// metrics, a fabricated customer claim) on live touches. This guardrail catches the most
// dangerous, testable class — specific metric claims (%, $, Nx) absent from the grounding
// facts (the leadBlock). Grounded metrics pass; bare numbers (durations, years) never flag.
describe("findUngroundedClaims", () => {
  it("flags a percentage not present in the grounding facts", () => {
    const grounding = "Pain points: slow onboarding\nTriggers: hired a new VP of Sales";
    const copy = "Saw your team grew headcount 40% last quarter — worth a look?";
    const violations = findUngroundedClaims(copy, grounding);
    expect(violations.map((v) => v.rule)).toContain("ungrounded-claim");
    expect(violations.some((v) => v.detail.includes("40%"))).toBe(true);
  });

  it("passes a percentage that appears in the grounding facts", () => {
    const grounding = "Triggers: reported 40% YoY revenue growth in Q2";
    const copy = "Your 40% growth this year is usually when this breaks — worth a look?";
    expect(findUngroundedClaims(copy, grounding)).toEqual([]);
  });

  it("flags a fabricated dollar figure", () => {
    const grounding = "Value angle: cut wasted ad spend";
    const copy = "Most teams like yours save $2M a year here.";
    const violations = findUngroundedClaims(copy, grounding);
    expect(violations.some((v) => v.detail.includes("$2M"))).toBe(true);
  });

  it("flags a fabricated multiplier", () => {
    const grounding = "Aha moment: faster pipeline";
    const copy = "Teams see 3x more meetings.";
    const violations = findUngroundedClaims(copy, grounding);
    expect(violations.some((v) => v.detail.toLowerCase().includes("3x"))).toBe(true);
  });

  it("does not flag plain numbers like meeting durations or years", () => {
    const grounding = "CTA goal: book a 15-min intro";
    const copy = "Open to a 15 min chat in 2026?";
    expect(findUngroundedClaims(copy, grounding)).toEqual([]);
  });

  it("matches case- and spacing-insensitively against the grounding", () => {
    const grounding = "Triggers: closed a $1.2M Series A";
    const copy = "Congrats on the $1.2m raise — worth a look?";
    expect(findUngroundedClaims(copy, grounding)).toEqual([]);
  });

  it("reports each ungrounded metric once", () => {
    const grounding = "Pain points: manual prospecting";
    const copy = "We lift reply rates 50% and 50% again — 50% is the floor.";
    const violations = findUngroundedClaims(copy, grounding);
    expect(violations.filter((v) => v.rule === "ungrounded-claim")).toHaveLength(1);
  });
});

describe("findUngroundedEntities", () => {
  it("flags an invented Series B not in the leadBlock", () => {
    const grounding = "Pain points: slow onboarding\nTriggers: none";
    const copy = "Congrats on the Series B — worth a look at how teams keep that capital working?";
    const violations = findUngroundedEntities(copy, grounding);
    expect(violations.map((v) => v.rule)).toContain("ungrounded-entity");
    expect(violations.some((v) => /series b/i.test(v.detail))).toBe(true);
  });

  it("passes Series B when it is present in the leadBlock", () => {
    const grounding = "Triggers: closed a $12M Series B last month";
    const copy = "Congrats on the Series B — usually that's when onboarding starts to creak.";
    expect(findUngroundedEntities(copy, grounding)).toEqual([]);
  });

  it("flags 'hired a new VP' when no hire trigger is in the grounding", () => {
    const grounding = "Pain points: manual prospecting\nTriggers: none";
    const copy = "Saw you hired a new VP — curious how you're ramping the team.";
    const violations = findUngroundedEntities(copy, grounding);
    expect(violations.map((v) => v.rule)).toContain("ungrounded-entity");
  });

  it("passes a hire clause that appears in the grounding", () => {
    const grounding = "Triggers: hired a new VP of Sales";
    const copy = "Saw you hired a new VP — that's usually when this conversation helps.";
    expect(findUngroundedEntities(copy, grounding)).toEqual([]);
  });

  it("does not flag generic capitalized words (no NER)", () => {
    const grounding = "Company: Harborline\nLocation: Austin";
    const copy = "Austin teams at Harborline usually feel this around Q3.";
    expect(findUngroundedEntities(copy, grounding)).toEqual([]);
  });

  it("does not flag 'raised a good point' without a funding clause", () => {
    const grounding = "Pain points: messy handoffs";
    const copy = "You raised a good point on handoffs — that's the exact gap.";
    expect(findUngroundedEntities(copy, grounding)).toEqual([]);
  });
});
