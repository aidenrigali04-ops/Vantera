import { describe, expect, it } from "vitest";
import { createLeadEventNotifier, type LeadEventEmailDeps, type LeadEventEmailTargets } from "./lead-event-emails";

const APP_URL = "https://app.example.com";
const EVENT = { kind: "meeting_booked" as const, accountId: "acct-1", leadId: "lead-1", snippet: "Booked for Tue" };

function makeDeps(
  targets: LeadEventEmailTargets,
  over: Partial<LeadEventEmailDeps> = {}
): { deps: LeadEventEmailDeps; sent: string[]; stamped: { accountId: string; at: Date }[] } {
  const sent: string[] = [];
  const stamped: { accountId: string; at: Date }[] = [];
  return {
    deps: {
      getTargets: async () => targets,
      send: async (opts) => {
        sent.push(opts.to);
      },
      stampLifecycleEmail: async (accountId, at) => {
        stamped.push({ accountId, at });
      },
      appUrl: APP_URL,
      ...over,
    },
    sent,
    stamped,
  };
}

describe("createLeadEventNotifier — lifecycle_last_email_at stamp", () => {
  // Task 8 fix round 1: a "meeting booked" email must block a pull-back email for 48h, same as
  // every other lifecycle sender (trial-ending, weekly-summary, dunning). This test proves the
  // stamp actually fires on the real send path, not just that the plumbing type-checks.
  it("stamps lifecycle_last_email_at when an email actually goes out", async () => {
    const { deps, sent, stamped } = makeDeps({
      enabled: true,
      leadName: "Jamie Prospect",
      emails: ["owner@acme.io", "admin@acme.io"],
    });
    await createLeadEventNotifier(deps)(EVENT);
    expect(sent).toEqual(["owner@acme.io", "admin@acme.io"]);
    expect(stamped).toHaveLength(1);
    expect(stamped[0]?.accountId).toBe("acct-1");
    expect(stamped[0]?.at).toBeInstanceOf(Date);
  });

  it("uses the injected now, not a fresh wall-clock Date", async () => {
    const FIXED_NOW = new Date("2026-07-19T12:00:00Z");
    const { deps, stamped } = makeDeps(
      { enabled: true, leadName: "Jamie Prospect", emails: ["owner@acme.io"] },
      { now: () => FIXED_NOW }
    );
    await createLeadEventNotifier(deps)(EVENT);
    expect(stamped[0]?.at).toBe(FIXED_NOW);
  });

  it("does NOT stamp when lead-event emails are disabled for the account", async () => {
    const { deps, sent, stamped } = makeDeps({
      enabled: false,
      leadName: "Jamie Prospect",
      emails: ["owner@acme.io"],
    });
    await createLeadEventNotifier(deps)(EVENT);
    expect(sent).toEqual([]);
    expect(stamped).toEqual([]);
  });

  it("does NOT stamp when there are zero recipients", async () => {
    const { deps, sent, stamped } = makeDeps({
      enabled: true,
      leadName: "Jamie Prospect",
      emails: [],
    });
    await createLeadEventNotifier(deps)(EVENT);
    expect(sent).toEqual([]);
    expect(stamped).toEqual([]);
  });

  it("never throws when stampLifecycleEmail is not stubbed (optional dep)", async () => {
    const { deps } = makeDeps({ enabled: true, leadName: "Jamie Prospect", emails: ["owner@acme.io"] });
    delete (deps as { stampLifecycleEmail?: unknown }).stampLifecycleEmail;
    await expect(createLeadEventNotifier(deps)(EVENT)).resolves.toBeUndefined();
  });

  it("still sends to the right kind-specific URL and leadName (unchanged behavior)", async () => {
    const urls: string[] = [];
    const { deps } = makeDeps(
      { enabled: true, leadName: "Jamie Prospect", emails: ["owner@acme.io"] },
      {
        send: async (opts) => {
          urls.push(opts.url);
          expect(opts.leadName).toBe("Jamie Prospect");
        },
      }
    );
    await createLeadEventNotifier(deps)(EVENT);
    expect(urls).toEqual([`${APP_URL}/meetings`]);
  });
});
