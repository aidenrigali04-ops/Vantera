import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { blockersFor } from "@/lib/engine/blockers";
import { loadEngineState } from "@/lib/engine/state";
import { fmtDate } from "./metrics";
import { buildQueueRows, pageSlice, type QueueSendIn, type SignalRowIn } from "./queue";
import type { QueueRow } from "./rows";
import { accountTimeZone, buildSenderFacts, type SenderRaw, type SendTodayRaw } from "./sender-facts";
import { downSenders } from "./state";
import type { ActionTileSpec } from "./tiles";

const DAY = 86_400_000;
/** Upper bound on pending drafts read per page load (global ordering needs the whole set). */
export const QUEUE_PAGE_HARD_CAP = 500;

type SendRow = SendTodayRaw & { sent_at?: string };

/** One page of the pending-review queue (the Approvals surface). RLS-scoped; no account id. */
export async function loadQueuePage(
  supabase: SupabaseClient,
  opts: { page: number; per: number; now?: Date }
): Promise<{
  rows: QueueRow[];
  total: number;
  /** true when the read hit the hard cap (show "500+") */
  capped: boolean;
  blockers: ActionTileSpec[];
  sendMode: "automatic" | "review" | "manual" | null;
  campaignId: string | null;
}> {
  const now = opts.now ?? new Date();
  const page = Math.max(1, Math.floor(opts.page));
  const per = Math.max(1, Math.floor(opts.per));
  const weekAgo = new Date(now.getTime() - 7 * DAY).toISOString();
  const sinceYesterdayish = new Date(now.getTime() - 36 * 3_600_000).toISOString();

  const [draftsRes, sendersRes, agentsRes, sendsTodayRes, weekRes, copyRes, engine] = await Promise.all([
    supabase
      .from("scheduled_sends")
      .select(
        "id, lead_id, body, style_flags, linkedin_stage, origin, recipe, created_at, leads(id, first_name, last_name, title, company_name, location, ai_score, ai_rationale, ai_insights, linkedin_url, status, linkedin_account_id)"
      )
      .eq("status", "pending_review")
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .limit(QUEUE_PAGE_HARD_CAP)
      .returns<QueueSendIn[]>(),
    supabase.from("linkedin_accounts").select("id, display_name, status, connected_at, updated_at").returns<SenderRaw[]>(),
    supabase.from("agents").select("kind, timezone").returns<{ kind: string; timezone: string | null }[]>(),
    supabase
      .from("outreach_sends")
      .select("linkedin_account_id, sent_at, scheduled_sends(linkedin_stage)")
      .gte("sent_at", sinceYesterdayish)
      .returns<(SendRow & { sent_at: string })[]>(),
    supabase
      .from("outreach_sends")
      .select("linkedin_account_id, scheduled_sends(linkedin_stage)")
      .gte("sent_at", weekAgo)
      .returns<SendTodayRaw[]>(),
    supabase
      .from("agents")
      .select("campaign_id, campaigns(send_mode)")
      .eq("kind", "copy")
      .limit(1)
      .returns<{ campaign_id: string | null; campaigns: { send_mode: string | null } | { send_mode: string | null }[] | null }[]>(),
    // The engine blockers stack (sender repairs, payment, no sender, the pause) — same state
    // the chrome chip reads, memoized per request.
    loadEngineState(supabase),
  ]);
  // Log the provider detail server-side; the thrown message is what an error boundary may render.
  if (draftsRes.error || sendersRes.error) {
    console.error("queue: read failed", draftsRes.error ?? sendersRes.error);
    throw new Error("Couldn't load your queue.");
  }

  const tz = accountTimeZone(agentsRes.data ?? []);
  const todayKey = fmtDate(now, tz);
  const todaySends = (sendsTodayRes.data ?? []).filter((x) => x.sent_at && fmtDate(new Date(x.sent_at), tz) === todayKey);
  const senders = buildSenderFacts(sendersRes.data ?? [], todaySends, weekRes.data ?? [], now);
  const downSenderIds = new Set(downSenders(senders).map((d) => d.id));

  const sends = draftsRes.data ?? [];
  const common = { sends, downSenderIds, now, limit: null, timeZone: tz, senders };
  // Global ordering + Follow-up numbering over the whole set; signals only for the page's leads.
  const leadIds = pageSlice(buildQueueRows({ ...common, signals: [] }), page, per)
    .map((r) => r.leadId)
    .filter((x): x is string => Boolean(x));
  let signals: SignalRowIn[] = [];
  if (leadIds.length > 0) {
    const { data } = await supabase
      .from("lead_signals")
      .select("lead_id, kind, label, observed_at")
      .in("lead_id", leadIds)
      .order("observed_at", { ascending: false })
      .returns<SignalRowIn[]>();
    signals = data ?? [];
  }
  const ordered = buildQueueRows({ ...common, signals });
  const rows = pageSlice(ordered, page, per);

  const copy = copyRes.data?.[0] ?? null;
  const camp = Array.isArray(copy?.campaigns) ? copy?.campaigns[0] : copy?.campaigns;
  const mode = camp?.send_mode;
  const sendMode = mode === "automatic" || mode === "review" || mode === "manual" ? mode : null;

  return {
    rows,
    total: ordered.length,
    capped: sends.length >= QUEUE_PAGE_HARD_CAP,
    blockers: blockersFor(engine, now),
    sendMode,
    campaignId: copy?.campaign_id ?? null,
  };
}
