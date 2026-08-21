import { describe, expect, it } from "vitest";
import {
  composeWeeklySummary,
  runWeeklySummary,
  type WeeklySummaryRow,
} from "./weekly-summary";

const APP_URL = "https://app.example.com";

function row(over: Partial<WeeklySummaryRow> = {}): WeeklySummaryRow {
  return {
    accountId: "acct-1",
    accountName: "Amplify",
    weeklySummaryEnabled: true,
    liveAgents: 2,
    sent: 34,
    replies: 5,
    meetings: 1,
    intentLeads: 3,
    qualified: 12,
    pipelineValueCents: 480000,
    goalCents: 5000000,
    recipients: ["owner@amplify.io"],
    ...over,
  };
}

describe("composeWeeklySummary", () => {
  it("leads the subject with the outcomes (replies + meetings), not the volume", () => {
    const msg = composeWeeklySummary(row(), APP_URL)!;
    expect(msg.subject).toBe("Your agents this week: 5 replies, 1 meeting booked");
    expect(msg.html).toContain("34");
    expect(msg.html).toContain("$4,800");
    expect(msg.html).toContain(`${APP_URL}/dashboard`);
    expect(msg.text).toContain("5 replies");
  });

  it("pluralizes and drops the meetings clause when there are none", () => {
    const msg = composeWeeklySummary(row({ replies: 1, meetings: 0 }), APP_URL)!;
    expect(msg.subject).toBe("Your agents this week: 1 reply");
  });

  it("renders a quiet-week variant when agents are live but nothing landed", () => {
    const msg = composeWeeklySummary(
      row({ sent: 0, replies: 0, meetings: 0, intentLeads: 0, qualified: 0, pipelineValueCents: null }),
      APP_URL
    )!;
    expect(msg.subject).toBe("Your agents this week");
    expect(msg.text.toLowerCase()).toContain("quiet week");
  });

  it("returns null (no email) when the account opted out", () => {
    expect(composeWeeklySummary(row({ weeklySummaryEnabled: false }), APP_URL)).toBeNull();
  });

  it("returns null when there are no recipients", () => {
    expect(composeWeeklySummary(row({ recipients: [] }), APP_URL)).toBeNull();
  });

  it("returns null for a dead week — zero activity AND no live agents (never sends noise)", () => {
    expect(
      composeWeeklySummary(
        row({ liveAgents: 0, sent: 0, replies: 0, meetings: 0, intentLeads: 0, qualified: 0 }),
        APP_URL
      )
    ).toBeNull();
  });

  it("escapes HTML in the account name", () => {
    const msg = composeWeeklySummary(row({ accountName: "<img src=x>" }), APP_URL)!;
    expect(msg.html).not.toContain("<img src=x>");
    expect(msg.html).toContain("&lt;img");
  });
});

describe("runWeeklySummary", () => {
  it("sends one email per recipient of each eligible account and counts skips", async () => {
    const sent: Array<{ to: string; subject: string }> = [];
    const summary = await runWeeklySummary({
      store: {
        listAccountsForSummary: async () => [
          row({ recipients: ["a@x.io", "b@x.io"] }),
          row({ accountId: "acct-2", weeklySummaryEnabled: false }),
          row({ accountId: "acct-3", liveAgents: 0, sent: 0, replies: 0, meetings: 0, intentLeads: 0, qualified: 0 }),
        ],
      },
      send: async (msg) => {
        sent.push({ to: msg.to, subject: msg.subject });
      },
      appUrl: APP_URL,
    });
    expect(sent).toHaveLength(2);
    expect(sent.map((s) => s.to)).toEqual(["a@x.io", "b@x.io"]);
    expect(summary).toEqual({ accounts: 3, emailed: 1, skipped: 2, failures: 0, stampFailures: 0 });
  });

  it("a failing send never blocks the other accounts", async () => {
    let calls = 0;
    const summary = await runWeeklySummary({
      store: {
        listAccountsForSummary: async () => [
          row({ accountId: "boom", recipients: ["a@x.io"] }),
          row({ accountId: "fine", recipients: ["b@x.io"] }),
        ],
      },
      send: async () => {
        calls++;
        if (calls === 1) throw new Error("provider down");
      },
      appUrl: APP_URL,
    });
    expect(summary.emailed).toBe(1);
    expect(summary.failures).toBe(1);
  });

  // Task 8: the pull-back collision guard reads accounts.lifecycle_last_email_at — worthless
  // unless the actually-sent summary stamps it, and only the actually-sent one.
  it("stamps lifecycle_last_email_at only for accounts that were actually emailed", async () => {
    const stamped: { accountId: string; at: Date }[] = [];
    const summary = await runWeeklySummary({
      store: {
        listAccountsForSummary: async () => [
          row({ accountId: "sent-to", recipients: ["a@x.io"] }),
          row({ accountId: "opted-out", weeklySummaryEnabled: false }),
        ],
        stampLifecycleEmail: async (accountId, at) => {
          stamped.push({ accountId, at });
        },
      },
      send: async () => {},
      appUrl: APP_URL,
    });
    expect(summary.emailed).toBe(1);
    expect(stamped).toHaveLength(1);
    expect(stamped[0]?.accountId).toBe("sent-to");
    expect(stamped[0]?.at).toBeInstanceOf(Date);
  });

  // Fix round 1 (MINOR): the stamp call used `new Date()` instead of the already-in-scope `now`
  // (computed from `deps.now?.()` above), breaking the injected-clock convention every sibling
  // sender follows and making the stamp non-deterministic under test. `toBe` (referential
  // equality) proves the code passes the SAME Date instance through, not just "a" Date — a
  // regression back to `new Date()` would fail this even though `toBeInstanceOf(Date)` above
  // would still pass.
  it("stamps with the injected now, not a fresh wall-clock Date", async () => {
    const FIXED_NOW = new Date("2026-07-20T00:00:00Z");
    const stamped: { accountId: string; at: Date }[] = [];
    await runWeeklySummary({
      store: {
        listAccountsForSummary: async () => [row({ accountId: "sent-to", recipients: ["a@x.io"] })],
        stampLifecycleEmail: async (accountId, at) => {
          stamped.push({ accountId, at });
        },
      },
      send: async () => {},
      appUrl: APP_URL,
      now: () => FIXED_NOW,
    });
    expect(stamped[0]?.at).toBe(FIXED_NOW);
  });

  /**
   * The collision-guard stamp is bookkeeping for a DIFFERENT feature (the pull-back email). It
   * used to share the send loop's try/catch, so a stamp throw — e.g. `column
   * "lifecycle_last_email_at" does not exist` with migration 0060 unapplied — was recorded as a
   * send failure on an account that had in fact been emailed. It now has its own try/catch and
   * its own counter; the send accounting must be completely untouched by a throwing stamp.
   */
  it("a throwing stamp is not counted as a send failure and does not sink the batch", async () => {
    const sent: string[] = [];
    const summary = await runWeeklySummary({
      store: {
        listAccountsForSummary: async () => [
          row({ accountId: "stamp-fails", recipients: ["a@x.io"] }),
          row({ accountId: "fine", recipients: ["b@x.io"] }),
        ],
        stampLifecycleEmail: async (accountId) => {
          if (accountId === "stamp-fails") {
            throw new Error('column "lifecycle_last_email_at" does not exist');
          }
        },
      },
      send: async ({ to }) => {
        sent.push(to);
      },
      appUrl: APP_URL,
    });
    expect(sent).toEqual(["a@x.io", "b@x.io"]);
    expect(summary).toEqual({
      accounts: 2,
      emailed: 2,
      skipped: 0,
      failures: 0,
      stampFailures: 1,
    });
  });

  it("a stamp that throws for EVERY account still emails every account", async () => {
    const sent: string[] = [];
    const summary = await runWeeklySummary({
      store: {
        listAccountsForSummary: async () => [
          row({ accountId: "a", recipients: ["a@x.io"] }),
          row({ accountId: "b", recipients: ["b@x.io"] }),
        ],
        stampLifecycleEmail: async () => {
          throw new Error("0060 not applied");
        },
      },
      send: async ({ to }) => {
        sent.push(to);
      },
      appUrl: APP_URL,
    });
    expect(sent).toEqual(["a@x.io", "b@x.io"]);
    expect(summary.emailed).toBe(2);
    expect(summary.failures).toBe(0);
    expect(summary.stampFailures).toBe(2);
  });
});
