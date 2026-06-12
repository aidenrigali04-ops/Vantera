import { describe, expect, it } from "vitest";
import { isPurgeable, runRetentionPurge, RETENTION_DAYS } from "./retention-purge";
import type { PurgeCandidate, RetentionStore } from "./types";

const base: PurgeCandidate = {
  id: "l1",
  status: "rejected",
  rulesGatePassed: false,
  scoredAt: null,
};

describe("isPurgeable (the 0002 retention note, exactly)", () => {
  it("purges gate-failed leads", () => {
    expect(isPurgeable({ ...base, rulesGatePassed: false })).toBe(true);
  });

  it("purges never-scored leads (gate never ran)", () => {
    expect(isPurgeable({ ...base, status: "sourced", rulesGatePassed: null, scoredAt: null })).toBe(true);
  });

  it("NEVER purges qualified or in-campaign leads, whatever the gate says", () => {
    for (const status of ["qualified", "enriched", "in_campaign", "replied", "converted", "archived"]) {
      expect(isPurgeable({ ...base, status })).toBe(false);
    }
  });

  it("keeps gate-passed leads awaiting scoring", () => {
    expect(isPurgeable({ ...base, status: "sourced", rulesGatePassed: true, scoredAt: null })).toBe(false);
  });
});

describe("runRetentionPurge", () => {
  function fakeStore(candidates: PurgeCandidate[]) {
    const deleted: string[][] = [];
    const store: RetentionStore = {
      async getPurgeCandidates() {
        return candidates;
      },
      async deleteLeads(ids) {
        deleted.push(ids);
        return ids.length;
      },
    };
    return { store, deleted };
  }

  it("asks for candidates older than the 90-day cutoff", async () => {
    let seenCutoff: Date | null = null;
    const now = new Date("2026-06-11T00:00:00Z");
    const store: RetentionStore = {
      async getPurgeCandidates(cutoff) {
        seenCutoff = cutoff;
        return [];
      },
      async deleteLeads() {
        return 0;
      },
    };
    await runRetentionPurge({ store, now: () => now });
    expect(seenCutoff!.getTime()).toBe(now.getTime() - RETENTION_DAYS * 86_400_000);
  });

  it("deletes only purgeable candidates and reports the count", async () => {
    const { store, deleted } = fakeStore([
      { id: "old-rejected", status: "rejected", rulesGatePassed: false, scoredAt: null },
      { id: "old-qualified", status: "qualified", rulesGatePassed: true, scoredAt: new Date() },
      { id: "old-unscored", status: "sourced", rulesGatePassed: null, scoredAt: null },
    ]);
    const summary = await runRetentionPurge({ store });
    expect(deleted.flat()).toEqual(["old-rejected", "old-unscored"]);
    expect(summary).toMatchObject({ status: "completed", purged: 2 });
  });

  it("skips the delete call entirely when nothing qualifies", async () => {
    const { store, deleted } = fakeStore([]);
    const summary = await runRetentionPurge({ store });
    expect(deleted).toEqual([]);
    expect(summary.purged).toBe(0);
  });
});
