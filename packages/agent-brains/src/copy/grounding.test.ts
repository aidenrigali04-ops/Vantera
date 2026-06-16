import { describe, expect, it } from "vitest";
import { findUngroundedClaims } from "./humanizer";

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
