import { describe, expect, it } from "vitest";
import { STARTER_PLAYS, matchStarterPlays, SOURCE_LABEL } from "./starter";
import { validateHumanity } from "../copy/humanizer";

describe("STARTER_PLAYS", () => {
  it("ships exactly three plays with unique slugs", () => {
    expect(STARTER_PLAYS).toHaveLength(3);
    expect(new Set(STARTER_PLAYS.map((p) => p.slug)).size).toBe(3);
  });

  it("every play carries a fully populated, legal CopyStrategy", () => {
    for (const p of STARTER_PLAYS) {
      expect(["trigger", "pain"]).toContain(p.strategy.openWith);
      expect(["tight", "standard"]).toContain(p.strategy.followupLength);
      expect(["soft", "specific"]).toContain(p.strategy.askStyle);
    }
  });

  it("every example opener fits a connection note and passes the humanizer", () => {
    for (const p of STARTER_PLAYS) {
      expect(p.exampleOpener.length).toBeLessThanOrEqual(200);
      // The same deterministic lint every real draft passes — a play may never model
      // copy the engine itself would flag.
      expect(validateHumanity(p.exampleOpener, { maxChars: 200 })).toEqual([]);
    }
  });

  it("every play is honestly sourced with a display label", () => {
    for (const p of STARTER_PLAYS) {
      expect(["first_party", "research"]).toContain(p.source);
      expect(SOURCE_LABEL[p.source]).toBeTruthy();
    }
    // The honesty rule (spec 2026-07-14): never claim network proof that doesn't exist.
    for (const label of Object.values(SOURCE_LABEL)) {
      expect(label.toLowerCase()).not.toContain("accounts like yours");
    }
  });
});

describe("matchStarterPlays", () => {
  it("always returns all plays, default-ordered with the first-party play leading", () => {
    const plays = matchStarterPlays({});
    expect(plays).toHaveLength(3);
    expect(plays[0]?.slug).toBe("trigger-opener");
  });

  it("puts the direct ask first for senior-executive ICPs", () => {
    const plays = matchStarterPlays({ icp: "CFOs at mid-market fintech companies" });
    expect(plays[0]?.slug).toBe("direct-ask");
    expect(plays).toHaveLength(3);
  });

  it("puts the problem-first note ahead for SaaS founder ICPs", () => {
    const plays = matchStarterPlays({ industry: "B2B SaaS", icp: "founders of early-stage software startups" });
    expect(plays[0]?.slug).toBe("pain-first");
  });

  it("is deterministic", () => {
    const a = matchStarterPlays({ industry: "B2B SaaS", icp: "VP Sales" });
    const b = matchStarterPlays({ industry: "B2B SaaS", icp: "VP Sales" });
    expect(a).toEqual(b);
  });

  it("tolerates null and undefined inputs", () => {
    expect(matchStarterPlays({ industry: null, icp: null })).toHaveLength(3);
    expect(matchStarterPlays({})).toHaveLength(3);
  });
});
