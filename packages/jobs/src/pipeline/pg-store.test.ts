import { describe, expect, it } from "vitest";
import type { Db } from "@vantera/db";
import { createPgStore } from "./pg-store";

// pg-store has no DB integration harness in this repo (siblings are pure-function
// unit tests). createPgStore only wires closures over `db` — it touches no rows at
// construction — so this is a signature/shape check that the SequenceStore methods
// are wired onto the returned store. Behavioral coverage lives in the pure cores
// (sequence-advance.test.ts) and the query shapes are guarded by type-check.
describe("createPgStore: sequence store surface", () => {
  const store = createPgStore(undefined as unknown as Db);

  it("exposes the SequenceStore methods", () => {
    expect(typeof store.getDueSequenceRuns).toBe("function");
    expect(typeof store.suppressionFlags).toBe("function");
    expect(typeof store.applyRunPatch).toBe("function");
    expect(typeof store.archiveLead).toBe("function");
    expect(typeof store.enrollPendingLeads).toBe("function");
    expect(typeof store.isKillSwitchOn).toBe("function");
  });

  it("applyRunPatch is the optimistic claim (runId, expectNextActionAt, patch)", () => {
    // 3-arity guard: a stale expectNextActionAt is what makes a second tick a no-op.
    expect(store.applyRunPatch.length).toBe(3);
  });
});
