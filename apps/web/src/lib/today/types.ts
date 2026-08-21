/**
 * Today — shared types for the pure core (`state`, `sentence`, `tiles`, `engine-line`,
 * `metrics`). Everything here is plain data the page's single round-trip produces; the
 * pure modules turn it into the screen. No IO, no React.
 */

export type SenderStatus = "connecting" | "active" | "restricted" | "disconnected";

export interface SenderFacts {
  id: string;
  /** First name + last initial ("Anna K.") — built server-side from display_name. */
  name: string;
  status: SenderStatus;
  /** Days since connected_at (0 when unknown); drives the warmup step. */
  ageDays: number;
  /** Today's sends by kind, per this sender. */
  invitesToday: number;
  messagesToday: number;
  /** Invites in the current Mon–Sun week. */
  invitesThisWeek: number;
  /** When the connection dropped (disconnected/restricted only). */
  statusChangedAt: string | null;
}

export type BillingStatus = "none" | "trialing" | "active" | "past_due" | "canceled";

export interface EngineFacts {
  /** a live Prospect (scout) agent exists */
  scoutLive: boolean;
  /** first run ever started at (null = never ran) */
  firstRunAt: string | null;
  /** last Outreach/Prospect run times */
  lastRunAt: string | null;
  nextRunAt: string | null;
  /** the account has ever had a draft land in the queue */
  everDrafted: boolean;
  /** the last three completed Prospect runs produced zero qualified leads */
  lastThreeRunsEmpty: boolean;
}

export interface TodayInputs {
  now: Date;
  timeZone: string;
  firstSessionDone: boolean;
  drafts: number;
  /** drafts held because their assigned sender is down */
  draftsHeld: number;
  repliesWaiting: number;
  repliesInterestedWaiting: number;
  /** oldest waiting reply's received_at */
  oldestWaitingAt: string | null;
  senders: SenderFacts[];
  pausedAt: string | null;
  billing: { status: BillingStatus; plan: string; pastDueSince: string | null; canceledAt: string | null };
  engine: EngineFacts;
  /** the user's previous Today visit */
  lastVisitAt: string | null;
}

export type TodayState =
  | "first_session"
  | "steady"
  | "caught_up"
  | "working_empty"
  | "starved"
  | "sender_held"
  | "stopped_senders"
  | "paused"
  | "stopped_billing";
