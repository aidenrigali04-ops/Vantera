import { type Attention } from "./agent-health";
import { fmtDayTime, fmtUntil } from "@/lib/today/metrics";
import { safeZone } from "@/lib/today/sender-facts";
import { funnelEmpty, type CardFunnels, type MiniStage } from "./card-funnel";

// Pure mapping from an agents row (+ counts, health, funnels) to the showcase view model.
// The loader (agent-showcase-data.ts) owns every read.

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
  cadence: "daily" | "weekly" | "intraday" | null;
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
  /** T4: why a LIVE agent needs the owner (null = healthy) — agent-health.ts */
  attention: Attention;
  /** server-formatted `fmtUntil(nextRunAt)`; the client re-ticks it every 60s */
  nextRunLabel: string;
  /** absolute next run ("Thu 10:30am", agent timezone) for the hover title */
  nextRunTitle: string | null;
  /** server-formatted "5h ago" of lastRunAt; null = no runs yet */
  lastRanLabel: string | null;
  /** T4: the last few recorded runs, newest first, server-formatted */
  runHistory: { agoLabel: string; line: string }[];
  /** UX-3: this agent's own mini funnel (card-funnel.ts); null when the proof read failed */
  funnel: MiniStage[] | null;
  funnelCaption: string | null;
  funnelEmpty: string;
};

export type AgentDbRow = {
  id: string;
  kind: ShowcaseKind;
  name: string;
  status: "draft" | "live" | "paused";
  config: Record<string, unknown> | null;
  cadence: "daily" | "weekly" | "intraday" | null;
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
    return `Hunting companies that fit ${who} every ${every}, scoring each one and keeping only the prospects worth your time — and learning which buyers actually convert.`;
  if (status === "paused")
    return `Paused. Resume and it goes straight back to sourcing and scoring companies that fit ${who}.`;
  return `Not deployed yet. Finish setup and it starts sourcing ${who} on your schedule.`;
}

function copySummary(status: string, channels: string[]): string {
  const where = channelPhrase(channels);
  if (status === "live")
    return `Writing a personalized message on ${where} for every qualified prospect from plays that are proven, keeping what works and dropping what doesn't — each draft waits in Approvals until you approve it.`;
  if (status === "paused")
    return `Paused. Resume and every qualified prospect gets a personalized draft on ${where} again.`;
  return `Not deployed yet. Deploy it and qualified prospects turn into personalized drafts on ${where}.`;
}

export function agoLabel(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

export function toShowcaseAgent(
  row: AgentDbRow,
  counts: { sourced: number; qualified: number; drafts: number },
  base: {
    attention: Attention;
    runHistory: { agoLabel: string; line: string }[];
    funnels: CardFunnels | null;
  }
): ShowcaseAgent {
  const { funnels, ...rest } = base;
  const health = {
    ...rest,
    funnel: funnels?.[row.kind] ?? null,
    funnelCaption: funnels?.captions[row.kind] ?? null,
    funnelEmpty: funnels ? funnelEmpty(row.kind, funnels) : "",
  };
  const icpNames = (row.agent_icps ?? [])
    .sort((a, b) => a.position - b.position)
    .map((l) => l.icps?.name)
    .filter((n): n is string => Boolean(n));

  const config = row.config ?? {};
  const now = new Date();
  const runs = {
    nextRunLabel: fmtUntil(row.next_run_at, now),
    nextRunTitle: row.next_run_at ? fmtDayTime(new Date(row.next_run_at), safeZone(row.timezone)) : null,
    lastRanLabel: row.last_run_at ? agoLabel(row.last_run_at) : null,
  };

  if (row.kind === "scout") {
    const { sourced, qualified } = counts;
    return {
      ...health,
      ...runs,
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
        { label: "Prospects sourced", value: sourced },
        { label: "Qualified", value: qualified },
      ],
      progress: {
        label: "Qualification rate",
        value: sourced > 0 ? Math.round((qualified / sourced) * 100) : 0,
        caption:
          sourced > 0
            ? `${qualified} of ${sourced} prospects kept`
            : "Waiting for the first run to bring prospects in",
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
      ...health,
      ...runs,
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
    ...health,
    ...runs,
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
