import {
  LINKEDIN_WEEKLY_INVITE_CEILING,
  dailyAllowance,
} from "@vantera/jobs/pipeline/safety-limits";
import { SEND_WINDOW, timezoneForLocation } from "@vantera/jobs/pipeline/send-window";
import type { SenderFacts } from "./types";

/**
 * Derived metrics + formatters for Today. Every cap number on screen comes from the
 * sending layer's own functions (blueprint D8: "the UI never hardcodes a cap"), and every
 * time string is produced here on the server so the client never calls Date.now().
 */

// ── caps / warmup ─────────────────────────────────────────────────────────────

export const WARMUP_DAYS = 28;

export interface CapUsage {
  invitesAllowed: number;
  messagesAllowed: number;
  invitesToday: number;
  messagesToday: number;
  sentToday: number;
  allowedToday: number;
  invitesThisWeek: number;
  weeklyCeiling: number;
  /** 1-based day of the ramp, null once steady */
  warmupDay: number | null;
  warmup: boolean;
}

export function capUsage(s: SenderFacts): CapUsage {
  const invitesAllowed = dailyAllowance("linkedin", s.ageDays, { kind: "invite" });
  const messagesAllowed = dailyAllowance("linkedin", s.ageDays, { kind: "message" });
  const warmup = s.ageDays < WARMUP_DAYS;
  return {
    invitesAllowed,
    messagesAllowed,
    invitesToday: s.invitesToday,
    messagesToday: s.messagesToday,
    sentToday: s.invitesToday + s.messagesToday,
    allowedToday: invitesAllowed + messagesAllowed,
    invitesThisWeek: s.invitesThisWeek,
    weeklyCeiling: LINKEDIN_WEEKLY_INVITE_CEILING,
    warmupDay: warmup ? Math.floor(s.ageDays) + 1 : null,
    warmup,
  };
}

/** `23/45` — sent today over today's total allowance. */
export function capFraction(s: SenderFacts): string {
  const c = capUsage(s);
  return `${c.sentToday}/${c.allowedToday}`;
}

/** The weekly invite ceiling is reached for this sender. */
export function weeklyCeilingReached(s: SenderFacts): boolean {
  return s.invitesThisWeek >= LINKEDIN_WEEKLY_INVITE_CEILING;
}

// ── rates ─────────────────────────────────────────────────────────────────────

export const REPLY_RATE_MIN_SENDS = 20;

/** replies ÷ sends, one decimal; null under 20 sends (too few to mean anything). */
export function replyRate(replies: number, sent: number): number | null {
  if (sent < REPLY_RATE_MIN_SENDS) return null;
  return Math.round((replies / sent) * 1000) / 10;
}

// ── formatting (server-side; the account timezone is passed in) ───────────────

const pad = (n: number) => String(n).padStart(2, "0");

function partsIn(date: Date, timeZone: string): { weekday: number; hour: number; minute: number; day: string; month: string } {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: false,
    month: "short",
    day: "numeric",
  });
  const p = Object.fromEntries(fmt.formatToParts(date).map((x) => [x.type, x.value]));
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(p.weekday ?? "Mon");
  const hour = Number(p.hour === "24" ? 0 : p.hour);
  return { weekday: weekday === -1 ? 1 : weekday, hour, minute: Number(p.minute), day: p.day ?? "", month: p.month ?? "" };
}

/** `2:10pm` — 12-hour, no space, lowercase meridiem, minutes only when non-zero is NOT the rule: always minutes. */
export function fmtTime(date: Date, timeZone: string): string {
  const { hour, minute } = partsIn(date, timeZone);
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12}:${pad(minute)}${hour < 12 ? "am" : "pm"}`;
}

/** `2:10–4:30pm` — a window; the meridiem rides the end unless the halves differ. */
export function fmtWindow(start: Date, end: Date, timeZone: string): string {
  const a = fmtTime(start, timeZone);
  const b = fmtTime(end, timeZone);
  const am = (s: string) => s.slice(-2);
  return am(a) === am(b) ? `${a.slice(0, -2)}–${b}` : `${a}–${b}`;
}

/** `Aug 19` */
export function fmtDate(date: Date, timeZone: string): string {
  const { day, month } = partsIn(date, timeZone);
  return `${month} ${day}`;
}

/** `Thu 10:30am` — for "next meeting". */
export function fmtDayTime(date: Date, timeZone: string): string {
  const { weekday } = partsIn(date, timeZone);
  return `${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][weekday]} ${fmtTime(date, timeZone)}`;
}

/** `5h` · `2d` · `now` — chip-grade relative age. Never "5 hours ago". */
export function fmtRelative(then: Date, now: Date): string {
  const mins = Math.max(0, Math.round((now.getTime() - then.getTime()) / 60_000));
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.round(hrs / 24)}d`;
}

/** `1,204` — never `1.2k` under 10k (and we never show ≥ 10k on Today). */
export function fmtCount(n: number): string {
  return n.toLocaleString("en-US");
}

/** `Yesterday 4:28pm` / `7:58am` — activity timestamps. */
export function fmtActivityTime(then: Date, now: Date, timeZone: string): string {
  const a = partsIn(then, timeZone);
  const b = partsIn(now, timeZone);
  const sameDay = a.day === b.day && a.month === b.month;
  if (sameDay) return fmtTime(then, timeZone);
  return `Yesterday ${fmtTime(then, timeZone)}`;
}

/** "Anna K." from a display name. */
export function shortName(displayName: string | null, fallback = "Your sender"): string {
  const parts = (displayName ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return fallback;
  if (parts.length === 1) return parts[0]!;
  return `${parts[0]} ${parts[parts.length - 1]![0]}.`;
}

/** Initials for an avatar square: "Maya Chen" → "MC", "Cher" → "CH". */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

// ── the send window (prospect-local, from the sending layer) ──────────────────

export interface SendSlot {
  /** the window is open right now (in the prospect's local time) */
  openNow: boolean;
  /** next window start, or now when open */
  startsAt: Date;
  /** that window's end */
  endsAt: Date;
  /** "today" | "tomorrow" | a weekday name */
  dayLabel: "today" | "tomorrow" | string;
}

function atHourInZone(base: Date, timeZone: string, hour: number): Date {
  // Build a UTC instant that reads as `hour:00` on `base`'s date in `timeZone`.
  const { hour: localHour, minute } = partsIn(base, timeZone);
  const diffMin = (hour - localHour) * 60 - minute;
  return new Date(base.getTime() + diffMin * 60_000);
}

/**
 * The next proactive-send window for a prospect, from the sending layer's SEND_WINDOW
 * (Mon–Fri, 8:00–16:59 in the PROSPECT's local time; unknown location → UTC). This is
 * the honest projection the row shows: the pacing engine picks a slot inside it.
 */
export function nextSendWindow(now: Date, location: string | null | undefined): SendSlot {
  const tz = timezoneForLocation(location) ?? "UTC";
  const days = SEND_WINDOW.days as readonly number[];
  for (let offset = 0; offset < 8; offset++) {
    const day = new Date(now.getTime() + offset * 86_400_000);
    const { weekday, hour } = partsIn(day, tz);
    if (!days.includes(weekday)) continue;
    const start = atHourInZone(day, tz, SEND_WINDOW.startHour);
    const end = atHourInZone(day, tz, SEND_WINDOW.endHour);
    if (offset === 0 && hour >= SEND_WINDOW.endHour) continue; // today's window already closed
    const openNow = offset === 0 && hour >= SEND_WINDOW.startHour;
    const label = offset === 0 ? "today" : offset === 1 ? "tomorrow" : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][weekday]!;
    return { openNow, startsAt: openNow ? now : start, endsAt: end, dayLabel: label };
  }
  // unreachable in practice (a 7-day scan always finds a weekday); fall back to tomorrow 8am UTC
  const t = new Date(now.getTime() + 86_400_000);
  return { openNow: false, startsAt: atHourInZone(t, "UTC", 8), endsAt: atHourInZone(t, "UTC", 17), dayLabel: "tomorrow" };
}

/**
 * The row's "Sends" cell: `2:10–4:30pm` (open now, in the ACCOUNT's display timezone),
 * `tomorrow 9:20am`, `Thu 8:00am`. Times display in the account timezone so every row on
 * the page reads on one clock; the window itself is the prospect's.
 */
export function fmtSendSlot(slot: SendSlot, timeZone: string): string {
  if (slot.openNow) return fmtWindow(slot.startsAt, slot.endsAt, timeZone);
  return `${slot.dayLabel} ${fmtTime(slot.startsAt, timeZone)}`;
}
