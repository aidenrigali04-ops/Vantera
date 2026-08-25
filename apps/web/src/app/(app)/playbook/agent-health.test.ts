import { describe, expect, it } from "vitest";
import { agentAttention, runLine, type AgentRunRow } from "./agent-health";

const run = (over: Partial<AgentRunRow>): AgentRunRow => ({
  agent_id: "a1",
  kind: "scout",
  status: "completed",
  summary: {},
  note: null,
  started_at: "2026-07-15T12:00:00Z",
  ...over,
});

describe("agentAttention", () => {
  it("paused agents never warn — their state is already explicit", () => {
    expect(
      agentAttention({ kind: "scout", status: "paused", linkedinActive: 0, lastRun: run({ status: "failed" }) })
    ).toBeNull();
  });

  it("a live copy agent with no LinkedIn connected cannot send — say so", () => {
    expect(
      agentAttention({ kind: "copy", status: "live", sendMode: "automatic", linkedinActive: 0, lastRun: null })
    ).toMatch(/can't send/);
    expect(
      agentAttention({ kind: "copy", status: "live", sendMode: "review", linkedinActive: 1, lastRun: null })
    ).toBeNull();
  });

  it("dead-scout class: target > 0 with 0 discovered surfaces to the user", () => {
    const r = run({ summary: { discoveryTarget: 25, discovered: 0, gatePassed: 0, qualified: 0 } });
    expect(agentAttention({ kind: "scout", status: "live", linkedinActive: 1, lastRun: r })).toMatch(/0 prospects/);
  });

  it("parked ICP criteria surface with a fix hint", () => {
    const r = run({ summary: { criteriaPending: 2, discoveryTarget: 25, discovered: 10 } });
    expect(agentAttention({ kind: "scout", status: "live", linkedinActive: 1, lastRun: r })).toMatch(/2 ICPs/);
  });

  it("a healthy run warns about nothing", () => {
    const r = run({ summary: { discoveryTarget: 25, discovered: 25, gatePassed: 20, qualified: 5 } });
    expect(agentAttention({ kind: "scout", status: "live", linkedinActive: 1, lastRun: r })).toBeNull();
  });

  it("intent: all reads failing points at the connection", () => {
    const r = run({ kind: "intent", summary: { targets: 4, sourcingErrors: 4, observed: 0 } });
    expect(agentAttention({ kind: "intent", status: "live", linkedinActive: 1, lastRun: r })).toMatch(/reconnect/);
  });

  it("failed runs warn regardless of kind", () => {
    expect(
      agentAttention({ kind: "intent", status: "live", linkedinActive: 1, lastRun: run({ status: "failed" }) })
    ).toMatch(/failed/);
  });

  it("intent: an empty watchlist is a failed setup, not a quiet day", () => {
    const r = run({ kind: "intent", status: "skipped", note: "empty_watchlist", summary: { reason: "empty_watchlist" } });
    expect(agentAttention({ kind: "intent", status: "live", linkedinActive: 1, lastRun: r })).toMatch(/watchlist/);
  });

  it("scout: rank errors with no qualified survivors warn that scoring failed", () => {
    const r = run({
      summary: { discoveryTarget: 10, discovered: 10, gatePassed: 8, qualified: 0, rankErrors: 8 },
    });
    expect(agentAttention({ kind: "scout", status: "live", linkedinActive: 1, lastRun: r })).toMatch(/Scoring failed/);
  });
});

describe("runLine", () => {
  it("formats a scout run with parked ICPs", () => {
    expect(
      runLine(run({ summary: { discovered: 25, gatePassed: 20, qualified: 5, criteriaPending: 1 } }))
    ).toBe("25 sourced → 20 passed gate → 5 qualified · 1 ICP parked");
  });

  it("formats an intent run", () => {
    expect(runLine(run({ kind: "intent", summary: { observed: 12, intent: 4, qualified: 2 } }))).toBe(
      "12 observed → 4 showing intent → 2 qualified"
    );
  });

  it("names skip reasons and failures honestly", () => {
    expect(runLine(run({ status: "skipped", note: "low_credits" }))).toBe("Skipped — sourcing capacity");
    expect(runLine(run({ status: "failed" }))).toBe("Run failed — retried automatically");
  });
});
