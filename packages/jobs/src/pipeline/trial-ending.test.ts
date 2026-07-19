import { describe, expect, it, vi } from "vitest";
import { runTrialEnding, type TrialEndingAccount } from "./trial-ending";

const NOW = new Date("2026-07-15T14:00:00Z");

function makeDeps(accounts: TrialEndingAccount[]) {
  const sent: { to: string; daysLeft: number }[] = [];
  const marked: string[][] = [];
  return {
    deps: {
      store: {
        getTrialEndingAccounts: vi.fn(async () => accounts),
        markTrialEndingNotified: vi.fn(async (ids: string[]) => {
          marked.push(ids);
        }),
      },
      send: vi.fn(async (opts: { to: string; daysLeft: number }) => {
        sent.push(opts);
      }),
      now: () => NOW,
    },
    sent,
    marked,
  };
}

describe("runTrialEnding", () => {
  it("emails every owner/admin and stamps the account once", async () => {
    const { deps, sent, marked } = makeDeps([
      { id: "a1", trialEndsAt: "2026-07-17T10:00:00Z", emails: ["o@x.com", "a@x.com"] },
    ]);
    const summary = await runTrialEnding(deps);
    expect(sent.map((s) => s.to)).toEqual(["o@x.com", "a@x.com"]);
    expect(sent[0]?.daysLeft).toBe(2);
    expect(marked).toEqual([["a1"]]);
    expect(summary).toEqual({
      status: "completed",
      notified: 1,
      emailsSent: 2,
      lifecycleStampFailures: 0,
    });
  });

  it("computes daysLeft with a floor of 1 (ends-tomorrow reads as 1 day)", async () => {
    const { deps, sent } = makeDeps([
      { id: "a1", trialEndsAt: "2026-07-16T02:00:00Z", emails: ["o@x.com"] },
    ]);
    await runTrialEnding(deps);
    expect(sent[0]?.daysLeft).toBe(1);
  });

  it("does not stamp an account whose every send failed (retries next run)", async () => {
    const { deps, marked } = makeDeps([
      { id: "a1", trialEndsAt: "2026-07-17T10:00:00Z", emails: ["o@x.com"] },
    ]);
    deps.send = vi.fn(async () => {
      throw new Error("mail down");
    });
    const summary = await runTrialEnding(deps);
    expect(marked).toEqual([]);
    expect(summary.notified).toBe(0);
  });

  it("is a clean no-op with nothing due", async () => {
    const { deps } = makeDeps([]);
    const summary = await runTrialEnding(deps);
    expect(summary).toEqual({
      status: "completed",
      notified: 0,
      emailsSent: 0,
      lifecycleStampFailures: 0,
    });
    expect(deps.store.markTrialEndingNotified).not.toHaveBeenCalled();
  });

  it("stamps lifecycle_last_email_at so pull-back yields to this email", async () => {
    const marked: string[] = [];
    const stamped: { ids: string[]; at: Date }[] = [];
    const now = new Date("2026-07-20T00:00:00Z");
    const summary = await runTrialEnding({
      store: {
        getTrialEndingAccounts: async () => [
          { id: "acc-1", trialEndsAt: "2026-07-22T00:00:00Z", emails: ["a@x.com"] },
        ],
        markTrialEndingNotified: async (ids) => {
          marked.push(...ids);
        },
        stampLifecycleEmails: async (ids, at) => {
          stamped.push({ ids, at });
        },
      },
      send: async () => {},
      now: () => now,
    });
    expect(marked).toEqual(["acc-1"]);
    expect(stamped).toEqual([{ ids: ["acc-1"], at: now }]);
    expect(summary.notified).toBe(1);
  });

  /**
   * The collision-guard stamp is bookkeeping for a DIFFERENT feature (the pull-back email) bolted
   * onto a job whose idempotence write is what stops it re-sending. It used to ride inside
   * markTrialEndingNotified's UPDATE, so with migration 0060 unapplied Postgres rejected the whole
   * statement, trial_ending_notified_at never landed, and the 15-minute agent-scheduler tick
   * re-sent the same trial-ending email to every eligible account forever. These two tests pin
   * both halves of the fix: the stamp is a separate call, and it cannot take the run down.
   */
  describe("a throwing lifecycle stamp cannot break idempotence", () => {
    function throwingStampDeps() {
      const marked: string[] = [];
      return {
        marked,
        deps: {
          store: {
            getTrialEndingAccounts: async () => [
              { id: "acc-1", trialEndsAt: "2026-07-22T00:00:00Z", emails: ["a@x.com"] },
              { id: "acc-2", trialEndsAt: "2026-07-22T00:00:00Z", emails: ["b@x.com"] },
            ],
            markTrialEndingNotified: async (ids: string[]) => {
              marked.push(...ids);
            },
            stampLifecycleEmails: async () => {
              // exactly what an unapplied 0060 produces
              throw new Error('column "lifecycle_last_email_at" does not exist');
            },
          },
          send: async () => {},
          now: () => new Date("2026-07-20T00:00:00Z"),
        },
      };
    }

    it("still writes trial_ending_notified_at for every account emailed", async () => {
      const { deps, marked } = throwingStampDeps();
      await runTrialEnding(deps);
      expect(marked).toEqual(["acc-1", "acc-2"]);
    });

    it("does not reject the run, and reports the stamp failure", async () => {
      const { deps } = throwingStampDeps();
      const summary = await runTrialEnding(deps);
      expect(summary).toEqual({
        status: "completed",
        notified: 2,
        emailsSent: 2,
        lifecycleStampFailures: 1,
      });
    });
  });
});
