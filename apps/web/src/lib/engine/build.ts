import { fmtDate } from "@/lib/today/metrics";
import { accountTimeZone, buildSenderFacts, type SenderRaw, type SendTodayRaw } from "@/lib/today/sender-facts";
import type { SenderFacts, TodayInputs } from "@/lib/today/types";

/**
 * The engine's run state — one plain-data snapshot the chrome chip, its popover, and the
 * Approvals blockers stack all read. Pure: `state.ts` does the (RLS-scoped) reads and hands
 * the rows here, so the shape is testable without a database.
 */

export type AgentKind = "scout" | "intent" | "copy";
export type AgentStatus = "draft" | "live" | "paused";

export interface EngineAgent {
  kind: AgentKind;
  status: AgentStatus;
  nextRunAt: string | null;
  lastRunAt: string | null;
}

export interface EngineState {
  pausedAt: string | null;
  billing: TodayInputs["billing"];
  senders: SenderFacts[];
  agents: EngineAgent[];
  /** pending drafts held because their assigned sender is down */
  draftsHeld: number;
  /** the account's display timezone (the Prospect agent's zone, else UTC) */
  timeZone: string;
}

/** The `accounts` columns the engine reads. */
export interface EngineAccountRow {
  paused_at: string | null;
  plan: string;
  subscription_status: string;
  current_period_end?: string | null;
}

export interface EngineAgentRaw {
  kind: AgentKind;
  status: AgentStatus;
  next_run_at: string | null;
  last_run_at: string | null;
  timezone: string | null;
}

export type EngineSendRaw = SendTodayRaw & { sent_at: string };

/** The three engine reads (senders, agents, the last ~36h of sends). */
export interface EngineRows {
  senders: SenderRaw[];
  agents: EngineAgentRaw[];
  sends: EngineSendRaw[];
}

const BILLING_STATUSES: ReadonlySet<string> = new Set(["none", "trialing", "active", "past_due", "canceled"]);

/** Billing facts as the engine sees them. A founder-exempt workspace is always "active". */
export function billingFacts(acct: EngineAccountRow, skipsPayment: boolean): TodayInputs["billing"] {
  const status = skipsPayment
    ? "active"
    : BILLING_STATUSES.has(acct.subscription_status)
      ? (acct.subscription_status as TodayInputs["billing"]["status"])
      : "none";
  return {
    status,
    plan: skipsPayment && (!acct.plan || acct.plan === "none") ? "growth" : acct.plan,
    pastDueSince: acct.subscription_status === "past_due" ? (acct.current_period_end ?? null) : null,
    canceledAt: acct.subscription_status === "canceled" ? (acct.current_period_end ?? null) : null,
  };
}

/** Rows → EngineState. "Today" is the account's local day (the sends read is a 36h window). */
export function buildEngineState(
  account: EngineAccountRow | null,
  rows: EngineRows,
  opts: { now: Date; skipsPayment: boolean; draftsHeld?: number }
): EngineState {
  const timeZone = accountTimeZone(rows.agents);
  const todayKey = fmtDate(opts.now, timeZone);
  const todaySends = rows.sends.filter((x) => x.sent_at && fmtDate(new Date(x.sent_at), timeZone) === todayKey);
  return {
    pausedAt: account?.paused_at ?? null,
    billing: account
      ? billingFacts(account, opts.skipsPayment)
      : { status: "none", plan: "none", pastDueSince: null, canceledAt: null },
    // The weekly read is not part of the engine state (nothing here shows a weekly figure).
    senders: buildSenderFacts(rows.senders, todaySends, [], opts.now),
    agents: rows.agents.map((a) => ({ kind: a.kind, status: a.status, nextRunAt: a.next_run_at, lastRunAt: a.last_run_at })),
    draftsHeld: opts.draftsHeld ?? 0,
    timeZone,
  };
}
