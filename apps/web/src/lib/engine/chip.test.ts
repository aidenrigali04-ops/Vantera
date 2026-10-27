import { describe, expect, it } from "vitest";
import { capUsage } from "@/lib/today/metrics";
import { senderFixture } from "@/lib/today/tiles";
import { chipFor, groupsFor } from "./chip";
import type { EngineState } from "./build";

const now = new Date("2026-10-26T15:00:00Z");

function state(over: Partial<EngineState> = {}): EngineState {
  return {
    pausedAt: null,
    billing: { status: "active", plan: "growth", pastDueSince: null, canceledAt: null },
    senders: [senderFixture()],
    agents: [],
    draftsHeld: 0,
    timeZone: "UTC",
    ...over,
  };
}

const liveScout = {
  kind: "scout" as const,
  status: "live" as const,
  nextRunAt: new Date(now.getTime() + 3 * 3_600_000).toISOString(),
  lastRunAt: null,
};

describe("chipFor — precedence", () => {
  it("1. a down sender outranks everything", () => {
    const c = chipFor(
      state({
        senders: [senderFixture({ status: "disconnected", name: "Anna K." })],
        pausedAt: now.toISOString(),
        billing: { status: "past_due", plan: "growth", pastDueSince: null, canceledAt: null },
        agents: [liveScout],
      }),
      now
    );
    expect(c).toMatchObject({ dot: "attention", label: "Anna K. disconnected", detail: "Reconnect", href: "/settings/senders" });
  });

  it("2. zero senders + a live Prospect agent → the LinkedIn chip (Review Focus 4)", () => {
    const c = chipFor(state({ senders: [], agents: [liveScout] }), now);
    expect(c).toMatchObject({ dot: "attention", label: "LinkedIn not connected", detail: "Connect", href: "/settings/senders" });
  });

  it("3. payment failed outranks the user's pause", () => {
    const c = chipFor(
      state({ pausedAt: now.toISOString(), billing: { status: "past_due", plan: "growth", pastDueSince: null, canceledAt: null } }),
      now
    );
    expect(c).toMatchObject({ dot: "attention", label: "Payment failed", detail: "Fix", href: "/settings/billing" });
  });

  it("4. paused by you", () => {
    const c = chipFor(state({ pausedAt: now.toISOString(), agents: [liveScout] }), now);
    expect(c).toMatchObject({ dot: "paused", label: "Paused by you", detail: "Resume", href: null, nextRunAt: null });
  });

  it("5. sending today → N of M invites, from the sending layer's caps", () => {
    const s = senderFixture({ invitesToday: 7, messagesToday: 2 });
    const c = chipFor(state({ senders: [s], agents: [liveScout] }), now);
    expect(c).toMatchObject({ dot: "running", label: "Sending", detail: `7 of ${capUsage(s).invitesAllowed} invites today` });
  });

  it("6. a live Prospect/Intent agent → finding prospects with the next run", () => {
    const c = chipFor(state({ agents: [liveScout] }), now);
    expect(c).toMatchObject({ dot: "running", label: "Finding prospects", detail: "next run in ~3h", nextRunAt: liveScout.nextRunAt });
    expect(c.nextRunTitle).toBeTruthy();
  });

  it("6b. the earliest live sourcing run wins; paused agents are ignored", () => {
    const soon = new Date(now.getTime() + 20 * 60_000).toISOString();
    const c = chipFor(
      state({
        agents: [
          liveScout,
          { kind: "intent", status: "live", nextRunAt: soon, lastRunAt: null },
          { kind: "scout", status: "paused", nextRunAt: now.toISOString(), lastRunAt: null },
        ],
      }),
      now
    );
    expect(c.detail).toBe("next run in ~20 min");
  });

  it("7. nothing running → Ready; no agents is not an error (Review Focus 5)", () => {
    const c = chipFor(state({ agents: [] }), now);
    expect(c).toMatchObject({ dot: "running", label: "Ready", detail: null, href: null, nextRunAt: null });
  });
});

describe("groupsFor", () => {
  it("reports each group's switch state; draft-only or missing agents are 'none'", () => {
    expect(groupsFor(state({ agents: [] }))).toEqual({ sourcing: "none", outreach: "none" });
    expect(
      groupsFor(
        state({
          agents: [
            { kind: "scout", status: "paused", nextRunAt: null, lastRunAt: null },
            { kind: "intent", status: "live", nextRunAt: null, lastRunAt: null },
            { kind: "copy", status: "draft", nextRunAt: null, lastRunAt: null },
          ],
        })
      )
    ).toEqual({ sourcing: "live", outreach: "none" });
    expect(
      groupsFor(state({ agents: [{ kind: "copy", status: "paused", nextRunAt: null, lastRunAt: null }] }))
    ).toEqual({ sourcing: "none", outreach: "paused" });
  });
});
