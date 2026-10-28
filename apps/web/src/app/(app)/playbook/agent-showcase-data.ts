import { createClient } from "@/lib/supabase/server";
import { agentAttention, runLine, type AgentRunRow } from "./agent-health";
import { loadCardFunnels } from "./card-funnel-data";
import { buildActivityFeed, type ActivityItem } from "./activity-feed";
import { agoLabel, toShowcaseAgent, type AgentDbRow, type ShowcaseAgent } from "./showcase-agent";

export type { ShowcaseAgent, ShowcaseKind, ShowcaseStat } from "./showcase-agent";

/** UX-3: the narrated account-wide activity feed, server-formatted. */
export type ShowcaseActivity = ActivityItem & { agoLabel: string };

export type AgentShowcaseData = { agents: ShowcaseAgent[]; activity: ShowcaseActivity[] };

/** Loads the agents (whichever exist), the real pipeline counts behind them, and the activity feed. */
export async function loadAgentShowcase(): Promise<AgentShowcaseData> {
  const supabase = await createClient();

  const [{ data: agents }, { count: sourced }, { count: qualified }, { count: drafts }, { data: runRows }, { count: liActive }, funnels, { data: account }] =
    await Promise.all([
      supabase
        .from("agents")
        .select(
          "id, kind, name, status, config, cadence, timezone, next_run_at, last_run_at, deployed_at, campaign_id, campaigns(send_mode), agent_icps(position, icps(name))"
        )
        .order("kind", { ascending: false }), // scout first
      supabase.from("leads").select("id", { count: "exact", head: true }),
      // "Qualified" = cumulative passed-the-bar, not just the not-yet-drafted pool —
      // a lead that qualified and moved into outreach (in_campaign)/replied/converted
      // still counts. Keeps the agent's headline yield + the qualification-rate honest
      // instead of collapsing to ~3 the moment the pool drains into outreach.
      supabase
        .from("leads")
        .select("id", { count: "exact", head: true })
        .in("status", ["qualified", "enriched", "in_campaign", "replied", "converted"]),
      supabase
        .from("scheduled_sends")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending_review"),
      // T4 operate path: recorded runs → the what-happened history + honest statuses.
      supabase
        .from("agent_runs")
        .select("agent_id, kind, status, summary, note, started_at")
        .order("started_at", { ascending: false })
        .limit(20)
        .returns<AgentRunRow[]>(),
      supabase
        .from("linkedin_accounts")
        .select("id", { count: "exact", head: true })
        .eq("status", "active"),
      loadCardFunnels(supabase), // UX-3: the one proof read for this request
      supabase.from("accounts").select("website_scanned_at").limit(1).maybeSingle<{ website_scanned_at: string | null }>(),
    ]);

  const counts = { sourced: sourced ?? 0, qualified: qualified ?? 0, drafts: drafts ?? 0 };
  const runsByAgent = new Map<string, AgentRunRow[]>();
  for (const r of runRows ?? []) {
    const list = runsByAgent.get(r.agent_id) ?? [];
    if (list.length < 5) list.push(r);
    runsByAgent.set(r.agent_id, list);
  }

  const rows = (agents as AgentDbRow[] | null) ?? [];
  // No timestamp records when the buyer profile was drafted, so that item stays out (null).
  const activity = buildActivityFeed({
    websiteScannedAt: account?.website_scanned_at ?? null,
    icpDraftedAt: null,
    agents: rows.map((r) => ({ kind: r.kind, deployed_at: r.deployed_at })),
    runs: runRows ?? [],
    now: new Date(),
  }).map((i) => ({ ...i, agoLabel: agoLabel(i.at) }));

  const showcase = rows.map((row) => {
    const runs = runsByAgent.get(row.id) ?? [];
    return toShowcaseAgent(row, counts, {
      attention: agentAttention({
        kind: row.kind,
        status: row.status,
        sendMode: row.campaigns?.send_mode ?? null,
        linkedinActive: liActive ?? 0,
        lastRun: runs[0] ?? null,
      }),
      runHistory: runs.map((r) => ({ agoLabel: agoLabel(r.started_at), line: runLine(r) })),
      funnels,
    });
  });
  return { agents: showcase, activity };
}
