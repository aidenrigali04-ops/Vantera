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
    expect(summary).toEqual({ accounts: 3, emailed: 1, skipped: 2, failures: 0 });
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
});
