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
    expect(summary).toEqual({ status: "completed", notified: 1, emailsSent: 2 });
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
    expect(summary).toEqual({ status: "completed", notified: 0, emailsSent: 0 });
    expect(deps.store.markTrialEndingNotified).not.toHaveBeenCalled();
  });
});
