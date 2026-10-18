import { describe, expect, it } from "vitest";
import { ARENAS } from "../hive/arenas";
import { createResearch, familyWiseScale, runGeneration, untestedMoves } from "./governor";

describe("foundation run", () => {
  it("widens the sealed bar as more proposals are compared", () => {
    expect(familyWiseScale(1)).toBe(1);
    expect(familyWiseScale(8)).toBeGreaterThan(1.4);
    expect(familyWiseScale(8)).toBeLessThan(familyWiseScale(32));
  });

  it("a wired-only hive never changes a gene the live pipeline cannot apply", async () => {
    const s = createResearch(11, { wiredOnly: true, multiplicity: true, proposalsPerGeneration: 6 });
    for (let i = 0; i < 3; i++) await runGeneration(s);
    for (const move of untestedMoves(s)) {
      expect(ARENAS[move.arena].genes[move.gene]?.wired).toBe(true);
    }
    for (const p of s.proposals) {
      for (const c of p.changes) expect(ARENAS[c.arena].genes[c.gene]?.wired).toBe(true);
    }
    expect(s.championScore).toBeLessThanOrEqual(s.sealedOracle + 1e-9);
  }, 60_000);
});
