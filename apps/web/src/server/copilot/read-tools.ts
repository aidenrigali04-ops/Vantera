import type { SupabaseClient } from "@supabase/supabase-js";

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
