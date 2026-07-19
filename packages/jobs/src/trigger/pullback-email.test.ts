import { describe, expect, it } from "vitest";
import { isPullbackMisconfigured } from "./pullback-email";
import { runPullback, type PullbackDeps, type PullbackRow } from "../pipeline/pullback";

/**
 * `pullback-email.ts` is a thin trigger wrapper (rule 13) that wires real deps (createDb,
 * sendPullbackEmail) — not unit-tested end to end. `isPullbackMisconfigured` is exported as a
 * small pure predicate specifically so the ERROR-vs-INFO log-level decision itself is testable
 * without a DB or the Trigger runtime. See IMPORTANT 1 in task-9-report.md fix round 1.
 */
describe("isPullbackMisconfigured", () => {
  it("flags sendFailures > 0 with zero emailsSent — the total-env-misconfiguration signature", () => {
    expect(isPullbackMisconfigured({ sendFailures: 3, emailsSent: 0 })).toBe(true);
  });

  it("does NOT flag one bad address among otherwise-successful sends", () => {
    expect(isPullbackMisconfigured({ sendFailures: 1, emailsSent: 5 })).toBe(false);
  });

  it("does NOT flag a clean tick with nothing to send (no candidates)", () => {
    expect(isPullbackMisconfigured({ sendFailures: 0, emailsSent: 0 })).toBe(false);
  });
});

function row(over: Partial<PullbackRow> = {}): PullbackRow {
  return {
    accountId: "acc-1",
    userId: "user-1",
    emails: ["founder@example.com", "cofounder@example.com"],
    segment: "drafts_waiting",
    touchNumber: 1,
    itemCount: 5,
    previews: [{ name: "Antonino Ingoglia", title: "Attorney", company: "Studio Legale" }],
    draftExcerpt: null,
    oldestArtifactAt: new Date("2026-07-17T00:00:00Z").toISOString(),
    lifecycleEmailsEnabled: true,
    lifecycleLastEmailAt: null,
    ...over,
  };
}

describe("non-vacuity: a totally misconfigured env drives both the counter and the ERROR branch", () => {
  it("every send() throwing (RESEND/LIFECYCLE_UNSUBSCRIBE_SECRET missing) yields sendFailures>0, emailsSent===0, and isPullbackMisconfigured===true", async () => {
    const deps: PullbackDeps = {
      store: {
        getPullbackCandidates: async () => [row()],
        recordTouch: async () => {},
        stampLifecycleEmail: async () => {},
      },
      send: async () => {
        // Mirrors createTransactionalEmailFromEnv() / signUnsubscribeToken() throwing inside the
        // send closure when RESEND_* or LIFECYCLE_UNSUBSCRIBE_SECRET is unset.
        throw new Error("transactional email env vars missing");
      },
      appUrl: "https://www.vanterasystem.dev",
      now: () => new Date("2026-07-19T12:00:00Z"),
    };

    const summary = await runPullback(deps);

    // Without sendFailures this is byte-identical to "no candidates found".
    expect(summary.touched).toBe(0);
    expect(summary.emailsSent).toBe(0);
    expect(summary.sendFailures).toBe(2);
    expect(isPullbackMisconfigured(summary)).toBe(true);
  });

  it("a healthy run with real sends takes the INFO branch, not the ERROR one", async () => {
    const deps: PullbackDeps = {
      store: {
        getPullbackCandidates: async () => [row()],
        recordTouch: async () => {},
        stampLifecycleEmail: async () => {},
      },
      send: async () => {},
      appUrl: "https://www.vanterasystem.dev",
      now: () => new Date("2026-07-19T12:00:00Z"),
    };

    const summary = await runPullback(deps);

    expect(summary.emailsSent).toBe(2);
    expect(summary.sendFailures).toBe(0);
    expect(isPullbackMisconfigured(summary)).toBe(false);
  });
});
