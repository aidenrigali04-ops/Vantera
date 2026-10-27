import { describe, expect, it } from "vitest";
import { buildActivityFeed, type ActivityInput } from "./activity-feed";
import { runLine, type AgentRunRow } from "./agent-health";

const now = new Date("2026-10-27T12:00:00Z");
const run = (o: Partial<AgentRunRow>): ActivityInput["runs"][number] => ({
  kind: "scout", status: "completed", started_at: "2026-10-26T10:00:00Z",
  summary: { discovered: 25, gatePassed: 20, qualified: 5 }, note: null, ...o,
});
const base = (o: Partial<ActivityInput> = {}): ActivityInput => ({
  websiteScannedAt: null, icpDraftedAt: null, agents: [], runs: [], now, ...o,
});

describe("buildActivityFeed", () => {
  it("is empty when nothing has happened", () => {
    expect(buildActivityFeed(base())).toEqual([]);
  });

  it("adds setup items only when their timestamps exist", () => {
    const feed = buildActivityFeed(
      base({
        websiteScannedAt: "2026-10-20T09:00:00Z",
        agents: [
          { kind: "scout", deployed_at: "2026-10-21T09:00:00Z" },
          { kind: "intent", deployed_at: null },
          { kind: "copy", deployed_at: "2026-10-22T09:00:00Z" },
        ],
      }),
    );
    expect(feed.map((i) => i.text)).toEqual(["Outreach agent live", "Prospect agent live", "Site read"]);
    expect(feed.every((i) => i.kind === "setup")).toBe(true);
    expect(feed.some((i) => i.text === "Buyer profile drafted")).toBe(false);
  });

  it("includes the buyer profile and intent agent when stamped", () => {
    const feed = buildActivityFeed(
      base({
        icpDraftedAt: "2026-10-20T10:00:00Z",
        agents: [{ kind: "intent", deployed_at: "2026-10-23T09:00:00Z" }],
      }),
    );
    expect(feed.map((i) => i.text)).toEqual(["Intent agent live", "Buyer profile drafted"]);
  });

  it("narrates completed runs with runLine, skipped and failed runs plainly", () => {
    const done = run({ started_at: "2026-10-26T10:00:00Z" });
    const intentDone = run({
      kind: "intent", started_at: "2026-10-26T11:00:00Z", summary: { observed: 90, intent: 4, qualified: 1 },
    });
    const skipped = run({ status: "skipped", note: "no_connection", started_at: "2026-10-25T10:00:00Z" });
    const skippedBare = run({ status: "skipped", note: null, started_at: "2026-10-24T10:00:00Z" });
    const failed = run({ status: "failed", started_at: "2026-10-23T10:00:00Z" });
    const feed = buildActivityFeed(base({ runs: [failed, done, skipped, intentDone, skippedBare] }));
    expect(feed.map((i) => i.text)).toEqual([
      runLine({ ...intentDone, agent_id: "x" }),
      runLine({ ...done, agent_id: "x" }),
      "Run skipped — no LinkedIn connection",
      "Run skipped",
      "Run failed",
    ]);
    expect(feed.every((i) => i.kind === "run")).toBe(true);
  });

  it("orders setup and runs together newest first", () => {
    const feed = buildActivityFeed(
      base({
        websiteScannedAt: "2026-10-26T09:30:00Z",
        agents: [{ kind: "scout", deployed_at: "2026-10-26T09:45:00Z" }],
        runs: [run({ started_at: "2026-10-26T10:00:00Z" })],
      }),
    );
    expect(feed.map((i) => i.kind)).toEqual(["run", "setup", "setup"]);
    expect(feed.map((i) => i.at)).toEqual([
      "2026-10-26T10:00:00Z", "2026-10-26T09:45:00Z", "2026-10-26T09:30:00Z",
    ]);
  });

  it("caps at 12 items, keeping the newest", () => {
    const runs = Array.from({ length: 20 }, (_, i) =>
      run({ started_at: new Date(Date.UTC(2026, 9, 1 + i)).toISOString() }),
    );
    const feed = buildActivityFeed(base({ websiteScannedAt: "2026-09-01T00:00:00Z", runs }));
    expect(feed).toHaveLength(12);
    expect(feed[0].at).toBe(new Date(Date.UTC(2026, 9, 20)).toISOString());
    expect(feed.some((i) => i.text === "Site read")).toBe(false);
  });

  it("drops future-dated items (clock skew) rather than showing them first", () => {
    const feed = buildActivityFeed(base({ runs: [run({ started_at: "2026-10-28T10:00:00Z" })] }));
    expect(feed).toEqual([]);
  });
});
