import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveEntitlements } from "@vantera/billing";
import { snapshotFromRow, type AccountBillingRow } from "@/lib/billing/entitlement";
import { getWarmupStatus, type WarmupStatus } from "@/lib/warmup-status";
import { loadAnalytics } from "@/lib/analytics";

// ── Draft queue ───────────────────────────────────────────────────────────────

export interface DraftQueueSummary {
  pendingReview: number;
  byChannel: { email: number; linkedin: number };
}

export async function getDraftQueueSummary(
  db: SupabaseClient,
  _accountId: string
): Promise<DraftQueueSummary> {
  const { data } = await db
    .from("scheduled_sends")
    .select("channel")
    .eq("status", "pending_review");
  const rows: { channel: string }[] = data ?? [];
  return {
    pendingReview: rows.length,
    byChannel: {
      email: rows.filter((r) => r.channel === "email").length,
      linkedin: rows.filter((r) => r.channel === "linkedin").length,
    },
  };
}

// ── Campaign / outreach agent status ─────────────────────────────────────────

export interface CampaignStatusDTO {
  agentName: string | null;
  live: boolean;
  sendMode: "review" | "automatic" | "manual" | null;
}

export async function getCampaignStatus(
  db: SupabaseClient,
  _accountId: string
): Promise<CampaignStatusDTO> {
  // agents.campaign_id FK → campaigns; PostgREST resolves campaigns(send_mode) via FK.
  // kind = 'copy' is the Outreach Agent (user-visible name).
  const { data } = await db
    .from("agents")
    .select("name, status, campaigns(send_mode)")
    .eq("kind", "copy")
    .limit(1)
    .maybeSingle();
  // PostgREST may return campaigns as an object or array depending on the FK relationship.
  const camp = data?.campaigns as unknown;
  const sendModeRaw: string | null = camp
    ? Array.isArray(camp)
      ? (camp[0] as { send_mode: string } | undefined)?.send_mode ?? null
      : (camp as { send_mode: string }).send_mode ?? null
    : null;
  return {
    agentName: data?.name ?? null,
    live: data?.status === "live",
    sendMode: sendModeRaw as "review" | "automatic" | "manual" | null,
  };
}

// ── Goal progress ─────────────────────────────────────────────────────────────

export interface GoalProgressDTO {
  /** Revenue goal in dollars (converted from revenue_goal_cents) — the copilot speaks
   *  to users in real numbers (rule 09); null if not set */
  goalRevenue: number | null;
  qualifiedLeads: number;
  inOutreach: number;
  replied: number;
}

export async function getGoalProgress(
  db: SupabaseClient,
  _accountId: string
): Promise<GoalProgressDTO> {
  const counts = async (statuses: string[]): Promise<number> => {
    const result = await db
      .from("leads")
      .select("id", { count: "exact", head: true })
      .in("status", statuses);
    return result.count ?? 0;
  };

  // revenue_goal_cents is the actual column (bigint, cents); one round-trip per metric, in parallel
  const [acct, qualifiedLeads, inOutreach, replied] = await Promise.all([
    db.from("accounts").select("revenue_goal_cents").limit(1).maybeSingle(),
    counts(["qualified", "enriched"]),
    counts(["in_campaign"]),
    counts(["replied", "converted"]),
  ]);

  const cents = acct.data?.revenue_goal_cents;
  return {
    goalRevenue: cents != null ? cents / 100 : null,
    qualifiedLeads,
    inOutreach,
    replied,
  };
}

// ── Lead score rationale ──────────────────────────────────────────────────────

export interface LeadScoreDTO {
  score: number | null;
  rationale: string | null;
}

export async function getLeadScoreRationale(
  db: SupabaseClient,
  leadName: string
): Promise<LeadScoreDTO> {
  const safe = leadName.replace(/[\\%_]/g, (c) => `\\${c}`);
  const { data } = await db
    .from("leads")
    .select("ai_score, ai_rationale")
    .ilike("first_name", `%${safe}%`)
    .limit(1)
    .maybeSingle();
  return {
    score: data?.ai_score ?? null,
    rationale: data?.ai_rationale ?? null,
  };
}

// ── Billing status ────────────────────────────────────────────────────────────

export interface BillingStatusDTO {
  plan: string;
  status: string;
  seats: { used: number; max: number };
  campaigns: { used: number; max: number };
}

export async function getBillingStatus(
  db: SupabaseClient,
  _accountId: string
): Promise<BillingStatusDTO> {
  const { data: row } = await db
    .from("accounts")
    .select(
      "plan, subscription_status, seats_purchased, linkedin_accounts_purchased, current_period_end"
    )
    .limit(1)
    .maybeSingle();
  const snap = snapshotFromRow(
    (row ?? {
      plan: "none",
      subscription_status: "none",
      seats_purchased: 0,
      linkedin_accounts_purchased: 0,
      current_period_end: null,
    }) as AccountBillingRow
  );
  const limits = resolveEntitlements(snap);
  const { count: seats } = await db
    .from("account_members")
    .select("user_id", { count: "exact", head: true });
  const { count: campaigns } = await db
    .from("campaigns")
    .select("id", { count: "exact", head: true });
  return {
    plan: snap.plan,
    status: snap.subscriptionStatus,
    seats: { used: seats ?? 0, max: limits.maxSeats },
    campaigns: { used: campaigns ?? 0, max: limits.maxCampaigns },
  };
}

// ── CRM connections + push status ─────────────────────────────────────────────

export interface CrmStatusDTO {
  connections: Array<{ destination: string; status: string }>;
  recentPushes: { success: number; pending: number; failed: number };
}

const CRM_LABELS: Record<string, string> = {
  hubspot: "HubSpot",
  salesforce: "Salesforce",
  gohighlevel: "GoHighLevel",
  slack: "Slack",
  monday: "Monday",
};

export async function getCrmStatus(
  db: SupabaseClient,
  _accountId: string
): Promise<CrmStatusDTO> {
  const { data: conns } = await db.from("crm_connections").select("provider, status");
  const { data: events } = await db.from("crm_push_events").select("status");
  const connRows: { provider: string; status: string }[] = conns ?? [];
  const eventRows: { status: string }[] = events ?? [];
  return {
    connections: connRows.map((c) => ({
      destination: CRM_LABELS[c.provider] ?? c.provider,
      status: c.status,
    })),
    recentPushes: {
      success: eventRows.filter((r) => r.status === "success").length,
      pending: eventRows.filter((r) => r.status === "pending").length,
      failed: eventRows.filter((r) => r.status === "failed").length,
    },
  };
}

// ── Warmup status ─────────────────────────────────────────────────────────────

// Re-export WarmupStatus so callers can reference the type without a separate import.
export type { WarmupStatus };

/**
 * Returns the current sending-channel warmup status for the account.
 * Answers "when does my email start?" / "why aren't emails going out yet?".
 * accountId MUST come from the validated session (rule 02).
 */
export async function getWarmupStatusForAccount(
  db: SupabaseClient,
  accountId: string
): Promise<WarmupStatus> {
  return getWarmupStatus(db, accountId);
}

// ── Return on spend (WS-A) ────────────────────────────────────────────────────

export interface ReturnOnSpendDTO {
  /** (closed + expected pipeline) ÷ annual plan spend, to 1 dp; null without a paid plan */
  pipelineToSpend: number | null;
  /** clears the 2× pipeline-to-spend bar that keeps a budget funded; null without spend */
  clearsRenewalBar: boolean | null;
  /** dollars per booked meeting; null until meetings are tracked / no plan */
  costPerMeeting: number | null;
  /** dollars per closed deal; null until a deal closes / no plan */
  costPerClose: number | null;
  /** annual plan spend in dollars; null without a paid plan */
  annualSpend: number | null;
  /** the account has set an average deal value (dollar figures depend on it) */
  hasValue: boolean;
  onPaidPlan: boolean;
}

/**
 * Return on spend for the copilot — the same numbers /analytics shows (shared loadAnalytics),
 * in dollars. Answers "is this worth it / what's my ROI / cost per meeting?". RLS scopes the
 * read to the caller's account (rule 02).
 */
export async function getReturnOnSpend(db: SupabaseClient): Promise<ReturnOnSpendDTO> {
  const { roi, hasValue } = await loadAnalytics(db);
  return {
    pipelineToSpend: roi.pipelineToSpend,
    clearsRenewalBar: roi.meetsThreshold,
    costPerMeeting: roi.costPerMeetingCents != null ? Math.round(roi.costPerMeetingCents / 100) : null,
    costPerClose: roi.costPerCloseCents != null ? Math.round(roi.costPerCloseCents / 100) : null,
    annualSpend: roi.hasSpend ? Math.round(roi.annualSpendCents / 100) : null,
    hasValue,
    onPaidPlan: roi.hasSpend,
  };
}

export interface ResponderStatusDTO {
  deployed: boolean;
  agentName: string | null;
  live: boolean;
  sendMode: "auto" | "review" | null;
  slaMinutes: number | null;
  inbound: { responded: number; inReview: number; rejected: number; total: number };
}

/**
 * Inbound Responder status for the copilot: whether one is deployed, how it responds, and the
 * inbound funnel (handled / in review / rejected). Answers "is my responder working?" / "how many
 * inbound leads have we answered?". RLS scopes the read to the caller's account (rule 02).
 */
export async function getResponderStatus(
  db: SupabaseClient,
  _accountId: string
): Promise<ResponderStatusDTO> {
  const { data: agent } = await db
    .from("agents")
    .select("name, status, config")
    .eq("kind", "responder")
    .limit(1)
    .maybeSingle();
  const a = agent as
    | { name?: string; status?: string; config?: { sendMode?: string; slaMinutes?: number } }
    | null;
  if (!a) {
    return {
      deployed: false,
      agentName: null,
      live: false,
      sendMode: null,
      slaMinutes: null,
      inbound: { responded: 0, inReview: 0, rejected: 0, total: 0 },
    };
  }
  const { data: inbound } = await db.from("inbound_leads").select("status");
  const rows: { status: string }[] = (inbound as { status: string }[] | null) ?? [];
  return {
    deployed: true,
    agentName: a.name ?? null,
    live: a.status === "live",
    sendMode: a.config?.sendMode === "auto" ? "auto" : "review",
    slaMinutes: typeof a.config?.slaMinutes === "number" ? a.config.slaMinutes : null,
    inbound: {
      responded: rows.filter((r) => r.status === "responded").length,
      inReview: rows.filter((r) => r.status === "review").length,
      rejected: rows.filter((r) => r.status === "rejected").length,
      total: rows.length,
    },
  };
}

export interface AdsStatusDTO {
  campaigns: number;
  conceptsGenerated: number;
  adLeads: number;
}

/**
 * Ads activity for the copilot: how many ad campaigns exist, how many concepts have been
 * generated, and how many leads have come in from ads. Answers "how are my ads doing?" /
 * "how many leads did ads bring in?". RLS scopes the read to the caller's account (rule 02).
 */
export async function getAdsStatus(db: SupabaseClient, _accountId: string): Promise<AdsStatusDTO> {
  const { data: campaigns } = await db.from("ad_campaigns").select("id");
  const { data: creatives } = await db.from("ad_creatives").select("id");
  const { data: adLeads } = await db.from("leads").select("id").eq("source", "ad");
  return {
    campaigns: (campaigns as unknown[] | null)?.length ?? 0,
    conceptsGenerated: (creatives as unknown[] | null)?.length ?? 0,
    adLeads: (adLeads as unknown[] | null)?.length ?? 0,
  };
}
