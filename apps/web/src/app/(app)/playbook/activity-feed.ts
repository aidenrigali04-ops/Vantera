import { runLine, skipReason, type AgentRunRow } from "./agent-health";

export type ActivityItem = { at: string; text: string; kind: "setup" | "run" };

export type ActivityInput = {
  websiteScannedAt: string | null;
  icpDraftedAt: string | null;
  agents: { kind: "scout" | "intent" | "copy"; deployed_at: string | null }[];
  runs: Pick<AgentRunRow, "kind" | "status" | "started_at" | "summary" | "note">[];
  now: Date;
};

export const ACTIVITY_CAP = 12;

const LIVE_TEXT = { scout: "Prospect agent live", intent: "Intent agent live", copy: "Outreach agent live" } as const;

function runText(run: ActivityInput["runs"][number]): string {
  if (run.status === "failed") return "Run failed";
  if (run.status === "skipped") {
    const reason = skipReason(run.note);
    return reason ? `Run skipped — ${reason}` : "Run skipped";
  }
  return runLine({ ...run, agent_id: "" });
}

/** The narrated "what Vera did" list: setup milestones + recorded runs, newest first, max 12. */
export function buildActivityFeed(input: ActivityInput): ActivityItem[] {
  const items: ActivityItem[] = [];
  if (input.websiteScannedAt) items.push({ at: input.websiteScannedAt, text: "Site read", kind: "setup" });
  if (input.icpDraftedAt) items.push({ at: input.icpDraftedAt, text: "Buyer profile drafted", kind: "setup" });
  for (const a of input.agents) {
    if (a.deployed_at) items.push({ at: a.deployed_at, text: LIVE_TEXT[a.kind], kind: "setup" });
  }
  for (const r of input.runs) items.push({ at: r.started_at, text: runText(r), kind: "run" });

  const nowMs = input.now.getTime();
  return items
    .filter((i) => {
      const t = new Date(i.at).getTime();
      return Number.isFinite(t) && t <= nowMs;
    })
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, ACTIVITY_CAP);
}
