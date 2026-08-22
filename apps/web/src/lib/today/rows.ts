/**
 * Row shapes the Today work card renders (blueprint §6.8). Produced server-side by
 * `lib/today/data.ts` — every time string is already formatted (account timezone), so the
 * client never touches Date. Sample identities only in tests/stories.
 */

import type { EngineLine } from "./engine-line";
import type { ActionTileSpec } from "./tiles";
import type { SenderStatus, TodayState } from "./types";

export type QueueStep = "Invite" | "Follow-up 1" | "Follow-up 2" | "Follow-up 3" | "Reply";

export interface QueueRow {
  /** scheduled_sends.id */
  id: string;
  leadId: string | null;
  name: string;
  /** `Founder · Northwind` (title · company; company alone if no title) */
  context: string;
  initials: string;
  /** top lead_signals row, or the step reason when there is no fresh signal */
  signal: { label: string; age: string; glyph: "briefcase" | "message-circle" | "arrow-up-right" | "rocket" | null } | null;
  signalFallback: string | null;
  score: number | null;
  step: QueueStep;
  /** `2:10–4:30pm · Anna K.` / `tomorrow 9:20am · Jonas M.` / `held · Jonas M.` */
  sends: { label: string; sender: string | null; held: boolean };
  /** draft body for the peek; subject is LinkedIn-null */
  body: string;
  styleFlags: string | null;
  channel: "linkedin";
  /** the peek's evidence bullets (≤ 4): signals + the rank's pain points / triggers */
  evidence: Array<{ text: string; href?: string }>;
  /** the rank's one-line rationale */
  rationale: string | null;
  /** the sending layer's cap for this step (invite note vs follow-up message) */
  charLimit: number;
  /** prospect's LinkedIn profile, for the evidence links */
  linkedinUrl: string | null;
}

export type ReplyClass = "Interested" | "Neutral" | "Out of office" | "Needs you";

export interface ReplyRow {
  /** replies.id */
  id: string;
  leadId: string;
  name: string;
  company: string | null;
  initials: string;
  /** first 90 characters of the body */
  excerpt: string;
  /** `Draft reply ready · approval needed` or the classifier's rationale (≤ 60 chars) */
  note: string | null;
  noteIsDraft: boolean;
  klass: ReplyClass;
  /** `5h` */
  received: string;
}

export type ActivityActor = "Prospect agent" | "Intent agent" | "Outreach agent" | "You" | string;

export interface ActivityRow {
  id: string;
  /** `7:58am` / `Yesterday 4:28pm` */
  time: string;
  /** plain text with optional link spans */
  parts: Array<{ text: string; href?: string; strong?: boolean; mono?: boolean }>;
  actor: ActivityActor;
}

export interface SenderChipRow {
  id: string;
  name: string;
  status: SenderStatus;
  /** `23/45` */
  fraction: string;
  warmup: boolean;
  /** tooltip line: `14 of 20 invites · 9 of 25 messages today · 61 of 100 invites this week` (+ warmup day) */
  tooltip: string;
}

export interface StatTile {
  label: string;
  value: string;
  note: string;
}

export interface TodayView {
  state: TodayState;
  greeting: string;
  sentence: string;
  primary: { label: string; count: number | null; href: string; inline?: "resume" } | null;
  banner: { tone: "attention" | "danger"; message: string; cta: { label: string; href: string } } | null;
  stats: [StatTile, StatTile, StatTile, StatTile];
  tiles: ActionTileSpec[];
  /** next run time, for the empty lines */
  nextRunLabel: string | null;
  queue: { rows: QueueRow[]; total: number; approvedToday: number };
  replies: { rows: ReplyRow[]; total: number; answeredThisWeek: number };
  activity: { rows: ActivityRow[]; engineStartedAgo: string | null };
  senders: SenderChipRow[];
  engine: EngineLine;
  /** `Updated 8:04am` */
  updatedLabel: string;
  paused: boolean;
  defaultTab: "queue" | "replies" | "activity";
}
