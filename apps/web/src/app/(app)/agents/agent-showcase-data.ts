import { createClient } from "@/lib/supabase/server";

export type ShowcaseKind = "scout" | "copy" | "intent";

export type ShowcaseStat = { label: string; value: number };

export type ShowcaseAgent = {
  id: string;
  kind: ShowcaseKind;
  roleLabel: string;
  name: string;
  status: "draft" | "live" | "paused";
  summary: string;
  icpNames: string[];
  cadence: "daily" | "weekly" | null;
  timezone: string;
  nextRunAt: string | null;
  lastRunAt: string | null;
  deployedAt: string | null;
  cta: string | null;
  channels: string[];
  sendMode: "automatic" | "review" | "manual" | null;
  campaignId: string | null;
  stats: ShowcaseStat[];
  /** Hero progress bar — only where a true 0–100 ratio exists (scout). */
  progress: { label: string; value: number; caption: string } | null;
};

type AgentDbRow = {
  id: string;
  kind: ShowcaseKind;
  name: string;
  status: "draft" | "live" | "paused";
  config: Record<string, unknown> | null;
  cadence: "daily" | "weekly" | null;
  timezone: string;
  next_run_at: string | null;
  last_run_at: string | null;
  deployed_at: string | null;
  campaign_id: string | null;
  campaigns: { send_mode: "automatic" | "review" | "manual" | null } | null;
  agent_icps: { position: number; icps: { name: string } | null }[];
};

function intentSummary(status: string, watchCount: number): string {
  const targets = `${watchCount} target${watchCount === 1 ? "" : "s"}`;
  if (status === "live")
    return `Watching ${targets} on LinkedIn — surfacing people who show buying intent and qualifying each against your ICP before they enter outreach.`;
  if (status === "paused")
    return "Paused. Resume and it goes back to watching LinkedIn for in-market behavior around your niche.";
  return "Not deployed yet. Deploy it and it watches LinkedIn for buying intent around your niche.";
}

function icpPhrase(names: string[]): string {
  if (names.length === 0) return "your ideal customers";
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}

function channelPhrase(channels: string[]): string {
  return channels.length > 0 ? "LinkedIn" : "your channels";
}

function scoutSummary(status: string, names: string[], cadence: string | null): string {
  const who = icpPhrase(names);
  const every = cadence === "weekly" ? "week" : "day";
  if (status === "live")
    return `Hunting companies that fit ${who} every ${every}, scoring each one and keeping only the leads worth your time — and learning which buyers actually convert.`;
  if (status === "paused")
    return `Paused. Resume and it goes straight back to sourcing and scoring companies that fit ${who}.`;
  return `Not deployed yet. Finish setup and it starts sourcing ${who} on your schedule.`;
}

function copySummary(status: string, channels: string[]): string {
  const where = channelPhrase(channels);
  if (status === "live")
    return `Writing a personalized message on ${where} for every qualified lead from plays that are proven, keeping what works and dropping what doesn't — each draft waits in your review queue until you approve it.`;
  if (status === "paused")
    return `Paused. Resume and every qualified lead gets a personalized draft on ${where} again.`;
  return `Not deployed yet. Deploy it and qualified leads turn into personalized drafts on ${where}.`;
}

function toShowcaseAgent(
  row: AgentDbRow,
  counts: { sourced: number; qualified: number; drafts: number }
): ShowcaseAgent {
  const icpNames = (row.agent_icps ?? [])
    .sort((a, b) => a.position - b.position)
    .map((l) => l.icps?.name)
    .filter((n): n is string => Boolean(n));

  const config = row.config ?? {};

  if (row.kind === "scout") {
    const { sourced, qualified } = counts;
    return {
      id: row.id,
      kind: "scout",
      roleLabel: "Prospect sourcing",
      name: row.name,
      status: row.status,
      summary: scoutSummary(row.status, icpNames, row.cadence),
      icpNames,
      cadence: row.cadence,
      timezone: row.timezone,
      nextRunAt: row.next_run_at,
      lastRunAt: row.last_run_at,
      deployedAt: row.deployed_at,
      cta: null,
      channels: [],
      sendMode: null,
      campaignId: null,
      stats: [
        { label: "Leads sourced", value: sourced },
        { label: "Qualified", value: qualified },
      ],
      progress: {
        label: "Qualification rate",
        value: sourced > 0 ? Math.round((qualified / sourced) * 100) : 0,
        caption:
          sourced > 0
            ? `${qualified} of ${sourced} leads kept`
            : "Waiting for the first run to bring leads in",
      },
    };
  }

  if (row.kind === "intent") {
    const watch = (config as { watch?: Record<string, unknown> }).watch ?? {};
    const watchCount = (["creators", "competitors", "keywords", "hashtags"] as const).reduce(
      (n, k) => n + (Array.isArray(watch[k]) ? (watch[k] as unknown[]).length : 0),
      0
    );
    return {
      id: row.id,
      kind: "intent",
      roleLabel: "Intent detection",
      name: row.name,
      status: row.status,
      summary: intentSummary(row.status, watchCount),
      icpNames,
      cadence: row.cadence,
      timezone: row.timezone,
      nextRunAt: row.next_run_at,
      lastRunAt: row.last_run_at,
      deployedAt: row.deployed_at,
      cta: null,
      channels: ["linkedin"],
      sendMode: null,
      campaignId: row.campaign_id,
      stats: [{ label: "Watching", value: watchCount }],
      progress: null,
    };
  }

  const channels = Array.isArray((config as { channels?: unknown }).channels)
    ? ((config as { channels: string[] }).channels)
    : Object.entries((config as { channels?: Record<string, boolean> }).channels ?? {})
        .filter(([, on]) => on)
        .map(([name]) => name);
  const cta = typeof (config as { cta?: unknown }).cta === "string" ? (config as { cta: string }).cta : null;

  return {
    id: row.id,
    kind: "copy",
    roleLabel: "Outreach & conversations",
    name: row.name,
    status: row.status,
    summary: copySummary(row.status, channels),
    icpNames,
    cadence: null,
    timezone: row.timezone,
    nextRunAt: null,
    lastRunAt: row.last_run_at,
    deployedAt: row.deployed_at,
    cta,
    channels,
    sendMode: row.campaigns?.send_mode ?? "review",
    campaignId: row.campaign_id,
    stats: [{ label: "Drafts in review", value: counts.drafts }],
    progress: null,
  };
}

/** Loads both agents (whichever exist) plus the real pipeline counts behind them. */
export async function loadAgentShowcase(): Promise<ShowcaseAgent[]> {
  const supabase = await createClient();

  const [{ data: agents }, { count: sourced }, { count: qualified }, { count: drafts }] =
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
    ]);

  const counts = { sourced: sourced ?? 0, qualified: qualified ?? 0, drafts: drafts ?? 0 };

  return ((agents as AgentDbRow[] | null) ?? []).map((row) => toShowcaseAgent(row, counts));
}
