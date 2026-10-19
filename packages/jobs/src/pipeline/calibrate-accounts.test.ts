import { describe, expect, it } from "vitest";
import type { FunnelCohort } from "@vantera/agent-brains";
import {
  HOLDOUT_MS,
  CALIBRATION_INTERVAL_MS,
  runAccountCalibration,
  withCalibration,
  type CalibrationSubject,
  type StoredCalibration,
} from "./calibrate-accounts";

const EMPTY: FunnelCohort = {
  sourced: 0,
  qualified: 0,
  invited: 0,
  accepted: 0,
  interested: 0,
  negative: 0,
  booked: 0,
  closed: 0,
};

/** Every stage denominator clears the sample gate. Same rates as the calibrate unit fixture. */
function thick(): FunnelCohort {
  return {
    sourced: 5000,
    qualified: 2500,
    invited: 2000,
    accepted: 600,
    interested: 120,
    negative: 30,
    booked: 48,
    closed: 12,
  };
}

const NOW = new Date("2026-10-18T12:00:00.000Z");

function harness(subjects: CalibrationSubject[], cohort: FunnelCohort = EMPTY) {
  const reads: { accountId: string; since?: Date; until?: Date }[] = [];
  const saved: { agentId: string; accountId: string; calibration: StoredCalibration }[] = [];
  let released = 0;
  const deps = {
    async listSubjects() {
      return subjects;
    },
    async getCohort(accountId: string, window?: { since?: Date; until?: Date }) {
      reads.push({ accountId, ...window });
      return cohort;
    },
    async saveCalibration(agentId: string, accountId: string, calibration: StoredCalibration) {
      saved.push({ agentId, accountId, calibration });
    },
    releaseWorldCache() {
      released += 1;
    },
  };
  return { deps, reads, saved, released: () => released };
}

describe("runAccountCalibration", () => {
  it("does nothing when the account has no subject", async () => {
    const { deps, reads, saved, released } = harness([]);
    const summary = await runAccountCalibration(deps, NOW);
    expect(summary).toEqual({ calibrated: 0, skipped: 0 });
    expect(reads).toEqual([]);
    expect(saved).toEqual([]);
    expect(released()).toBe(0);
  });

  it("leaves the assumed ranges in place when the training window is too thin", async () => {
    const { deps, saved } = harness([{ accountId: "acct", agentId: "subject-1", checkedAt: null }]);
    const summary = await runAccountCalibration(deps, NOW);
    expect(summary.calibrated).toBe(1);
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({
      agentId: "subject-1",
      accountId: "acct",
      calibration: { fitted: false, holdout: "inconclusive", ranges: null },
    });
    expect(saved[0]!.calibration.checkedAt).toBe(NOW.toISOString());
  });

  it("stores fitted ranges and an inside holdout when both windows clear the gate", async () => {
    const { deps, reads, saved } = harness(
      [{ accountId: "acct", agentId: "subject-1", checkedAt: null }],
      thick()
    );
    await runAccountCalibration(deps, NOW);
    const holdoutStart = new Date(NOW.getTime() - HOLDOUT_MS);
    expect(reads.map((r) => r.accountId)).toEqual(["acct", "acct"]);
    expect(reads[0]!.until).toEqual(holdoutStart);
    expect(reads[0]!.since).toBeUndefined();
    expect(reads[1]!.since).toEqual(holdoutStart);
    expect(reads[1]!.until).toEqual(NOW);
    expect(saved[0]!.calibration.fitted).toBe(true);
    expect(saved[0]!.calibration.holdout).toBe("inside");
    expect(saved[0]!.calibration.ranges).not.toBeNull();
    expect(saved[0]!.calibration.ranges!.acc[0]).toBeLessThan(0.3);
    expect(saved[0]!.calibration.ranges!.acc[1]).toBeGreaterThan(0.3);
  });

  it("skips a subject calibrated inside the interval", async () => {
    const checkedAt = new Date(NOW.getTime() - CALIBRATION_INTERVAL_MS + 60_000).toISOString();
    const { deps, reads, saved } = harness([{ accountId: "acct", agentId: "subject-1", checkedAt }]);
    const summary = await runAccountCalibration(deps, NOW);
    expect(summary).toEqual({ calibrated: 0, skipped: 1 });
    expect(reads).toEqual([]);
    expect(saved).toEqual([]);
  });

  it("keeps the rest of the subject config when it records a calibration", () => {
    const next = withCalibration(
      { name: "First subject", guardrails: { max: 1 } },
      {
        fitted: false,
        holdout: "inconclusive",
        reason: "thin",
        ranges: null,
        checkedAt: NOW.toISOString(),
      }
    );
    expect(next).toEqual({
      name: "First subject",
      guardrails: { max: 1 },
      calibration: {
        fitted: false,
        holdout: "inconclusive",
        reason: "thin",
        ranges: null,
        checkedAt: NOW.toISOString(),
      },
    });
  });

  it("drops the world cache after each subject it calibrates", async () => {
    const { deps, released } = harness(
      [
        { accountId: "a", agentId: "s1", checkedAt: null },
        { accountId: "b", agentId: "s2", checkedAt: null },
      ],
      thick()
    );
    const summary = await runAccountCalibration(deps, NOW);
    expect(summary.calibrated).toBe(2);
    expect(released()).toBe(2);
  });
});
