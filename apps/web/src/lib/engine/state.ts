import "server-only";
import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { accountSkipsPayment } from "@/lib/billing/founder-exempt";
import { downSenders } from "@/lib/today/state";
import type { SenderRaw } from "@/lib/today/sender-facts";
import { buildEngineState, type EngineAccountRow, type EngineAgentRaw, type EngineRows, type EngineSendRaw, type EngineState } from "./build";

export type { EngineState } from "./build";

/**
 * Engine state reads (UX-2 Task 9). All RLS-scoped to the session's account (rule 02) — no
 * account id is ever passed. `readEngineRows` is split out so the app layout can fire it as one
 * entry of its single `Promise.all` (shell data stays one round-trip).
 */
export async function readEngineRows(supabase: SupabaseClient, now: Date): Promise<EngineRows> {
  // "today" is the account's day and the zone is itself one of these reads — pull 36h and
  // filter once the zone is known (same convention as loadToday / loadQueuePage).
  const since = new Date(now.getTime() - 36 * 3_600_000).toISOString();
  const [senders, agents, sends] = await Promise.all([
    supabase.from("linkedin_accounts").select("id, display_name, status, connected_at, updated_at").returns<SenderRaw[]>(),
    supabase.from("agents").select("kind, status, next_run_at, last_run_at, timezone").returns<EngineAgentRaw[]>(),
    supabase
      .from("outreach_sends")
      .select("linkedin_account_id, sent_at, scheduled_sends(linkedin_stage)")
      .gte("sent_at", since)
      .returns<EngineSendRaw[]>(),
  ]);
  return { senders: senders.data ?? [], agents: agents.data ?? [], sends: sends.data ?? [] };
}

/** Pending drafts whose assigned sender is down (read only when a sender IS down). */
async function countDraftsHeld(supabase: SupabaseClient, downIds: string[]): Promise<number> {
  if (downIds.length === 0) return 0;
  const { count } = await supabase
    .from("scheduled_sends")
    .select("id, leads!inner(linkedin_account_id)", { count: "exact", head: true })
    .eq("status", "pending_review")
    .in("leads.linkedin_account_id", downIds);
  return count ?? 0;
}

type AccountWithId = EngineAccountRow & { id: string; stripe_subscription_id: string | null };

/**
 * The full engine state for the session's workspace, memoized per request. Pass the account
 * row when the caller already read it; otherwise it is read here.
 */
export const loadEngineState = cache(async (supabase: SupabaseClient, account?: AccountWithId | null): Promise<EngineState> => {
  const now = new Date();
  const [acct, rows] = await Promise.all([
    account !== undefined
      ? Promise.resolve(account)
      : supabase
          .from("accounts")
          .select("id, paused_at, plan, subscription_status, current_period_end, stripe_subscription_id")
          .limit(1)
          .maybeSingle<AccountWithId>()
          .then((r) => r.data),
    readEngineRows(supabase, now),
  ]);
  const skipsPayment = Boolean(acct && !acct.stripe_subscription_id && (await accountSkipsPayment(supabase, acct.id)));
  const draft = buildEngineState(acct, rows, { now, skipsPayment });
  const draftsHeld = await countDraftsHeld(supabase, downSenders(draft.senders).map((s) => s.id));
  return { ...draft, draftsHeld };
});
