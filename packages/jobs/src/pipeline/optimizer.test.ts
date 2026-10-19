import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { runOptimizer } from "./optimizer";

describe("runOptimizer", () => {
  it("refreshes calibration, asks for a proposal, and does not launch it", async () => {
    const calls: string[] = [];
    const summary = await runOptimizer(
      { accountId: "acct", agentId: "subject-1" },
      {
        async refreshCalibration(accountId) {
          calls.push(`calibrate:${accountId}`);
        },
        async propose(accountId) {
          calls.push(`propose:${accountId}`);
          return { summary: "try a shorter opener" };
        },
        releaseWorldCache() {
          calls.push("release");
        },
      }
    );
    expect(calls).toEqual(["calibrate:acct", "propose:acct", "release"]);
    expect(summary).toEqual({ refreshed: true, waitingForApproval: true });
  });

  it("records that nothing is waiting when the proposer has no candidate", async () => {
    const summary = await runOptimizer(
      { accountId: "acct", agentId: "subject-1" },
      {
        async refreshCalibration() {},
        async propose() {
          return null;
        },
        releaseWorldCache() {},
      }
    );
    expect(summary.waitingForApproval).toBe(false);
  });

  it("does not send", () => {
    const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "optimizer.ts"), "utf8");
    expect(src).not.toMatch(/scheduled_sends|insertScheduledSend|outreach-send|pending_review/);
  });
});
