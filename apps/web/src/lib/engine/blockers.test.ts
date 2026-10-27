import { describe, expect, it } from "vitest";
import { senderFixture } from "@/lib/today/tiles";
import { blockersFor } from "./blockers";
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

describe("blockersFor", () => {
  it("a healthy, unpaused, paid workspace has no blockers", () => {
    expect(blockersFor(state(), now)).toEqual([]);
  });

  it("orders repairs (P0) before the missing sender (P1) before the pause (P2)", () => {
    const kinds = blockersFor(
      state({
        senders: [
          senderFixture({ id: "a", status: "disconnected" }),
          senderFixture({ id: "b", status: "restricted" }),
        ],
        draftsHeld: 4,
        billing: { status: "past_due", plan: "growth", pastDueSince: now.toISOString(), canceledAt: null },
        pausedAt: now.toISOString(),
      }),
      now
    ).map((t) => t.kind);
    expect(kinds).toEqual(["sender_disconnected", "sender_restricted", "payment_failed", "engine_paused"]);
  });

  it("zero senders → sender_missing, then the pause", () => {
    const tiles = blockersFor(state({ senders: [], pausedAt: now.toISOString() }), now);
    expect(tiles.map((t) => t.kind)).toEqual(["sender_missing", "engine_paused"]);
    expect(tiles[1]?.inline).toBe("resume");
  });

  it("carries the held-drafts count on the reconnect tile", () => {
    const [tile] = blockersFor(state({ senders: [senderFixture({ status: "disconnected" })], draftsHeld: 3 }), now);
    expect(tile?.meta).toContain("‹3› drafts held");
    expect(tile?.href).toBe("/settings/senders#s1");
  });

  it("never returns a non-blocker kind", () => {
    const allowed = new Set(["sender_disconnected", "sender_restricted", "payment_failed", "subscription_ended", "sender_missing", "engine_paused"]);
    const tiles = blockersFor(
      state({
        senders: [],
        billing: { status: "past_due", plan: "growth", pastDueSince: null, canceledAt: null },
        pausedAt: now.toISOString(),
      }),
      now
    );
    expect(tiles.every((t) => allowed.has(t.kind))).toBe(true);
  });

  it("a canceled or never-started subscription → subscription_ended (Restart → billing), before the pause", () => {
    for (const status of ["canceled", "none"] as const) {
      const tiles = blockersFor(
        state({ billing: { status, plan: "none", pastDueSince: null, canceledAt: null }, pausedAt: now.toISOString() }),
        now
      );
      expect(tiles.map((t) => t.kind)).toEqual(["subscription_ended", "engine_paused"]);
      expect(tiles[0]).toMatchObject({ title: "Subscription ended", href: "/settings/billing", priority: 0, tone: "billing" });
      expect(tiles[0]?.meta).toMatch(/^Restart/);
    }
  });

  it("active, trialing and past-due workspaces show no subscription_ended tile", () => {
    for (const status of ["active", "trialing", "past_due"] as const) {
      const kinds = blockersFor(state({ billing: { status, plan: "growth", pastDueSince: null, canceledAt: null } }), now).map((t) => t.kind);
      expect(kinds).not.toContain("subscription_ended");
    }
  });
});
