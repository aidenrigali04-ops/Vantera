import { describe, expect, it } from "vitest";
import { assignSender, inviteBudget, type SenderCandidate } from "./sender-assignment";

function candidate(over: Partial<SenderCandidate> = {}): SenderCandidate {
  return {
    linkedinAccountId: "a",
    ageDays: 60, // steady-state (20/day) unless overridden
    sentToday: 0,
    last7d: 0,
    lastAssignedAt: 0,
    healthy: true,
    ...over,
  };
}

describe("inviteBudget", () => {
  it("is the steady daily allowance for a mature, idle account", () => {
    expect(inviteBudget(candidate())).toBe(20);
  });

  it("subtracts what was already sent today", () => {
    expect(inviteBudget(candidate({ sentToday: 13 }))).toBe(7);
  });

  it("is clamped by the rolling weekly ceiling even when daily budget remains", () => {
    // mature daily = 20, but only 3 left under the 100/week ceiling
    expect(inviteBudget(candidate({ last7d: 97 }))).toBe(3);
  });

  it("respects the warmup ramp for a young account", () => {
    // <7 days → 5/day ceiling
    expect(inviteBudget(candidate({ ageDays: 3 }))).toBe(5);
  });

  it("never goes negative", () => {
    expect(inviteBudget(candidate({ sentToday: 50 }))).toBe(0);
  });
});

describe("assignSender", () => {
  it("picks the healthy account with the most remaining budget", () => {
    const chosen = assignSender([
      candidate({ linkedinAccountId: "low", sentToday: 18 }), // budget 2
      candidate({ linkedinAccountId: "high", sentToday: 2 }), // budget 18
    ]);
    expect(chosen).toBe("high");
  });

  it("excludes unhealthy accounts even if they would have budget", () => {
    const chosen = assignSender([
      candidate({ linkedinAccountId: "sick", healthy: false }), // budget 20 but unhealthy
      candidate({ linkedinAccountId: "ok", sentToday: 15 }), // budget 5
    ]);
    expect(chosen).toBe("ok");
  });

  it("returns null when no candidate has remaining budget", () => {
    const chosen = assignSender([
      candidate({ linkedinAccountId: "a", sentToday: 20 }),
      candidate({ linkedinAccountId: "b", last7d: 100 }),
    ]);
    expect(chosen).toBeNull();
  });

  it("breaks budget ties by least-recently-assigned (even spread)", () => {
    const chosen = assignSender([
      candidate({ linkedinAccountId: "recent", lastAssignedAt: 5000 }),
      candidate({ linkedinAccountId: "stale", lastAssignedAt: 1000 }),
    ]);
    expect(chosen).toBe("stale");
  });

  it("returns null for an empty candidate set", () => {
    expect(assignSender([])).toBeNull();
  });
});
