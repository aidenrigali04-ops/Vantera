import { fmtDate, fmtRelative, fmtTime, fmtWindow, nextSendWindow } from "./metrics";
import { dealSizeTile } from "./deal-size-tile";
import { downSenders, healthySenders } from "./state";
import type { SenderFacts, TodayInputs } from "./types";

/**
 * Z4 · "Needs you" — the to-do, in priority order (blueprint §7 Z4). A pure priority
 * engine: `tilesFor(inputs)` returns at most four tiles, P0/P1 always, P2 when it exists,
 * P3/P4 only into a free slot and at most once per day each, honoring dismissals.
 */

export type TileTone = "routine" | "replies" | "attention" | "billing";

export type TileKind =
  | "sender_missing"
  | "sender_disconnected"
  | "sender_restricted"
  | "payment_failed"
  | "subscription_ended"
  | "drafts"
  | "replies"
  | "needs_human"
  | "meeting_today"
  | "engine_paused"
  | "playbook_suggestion"
  | "style_memory"
  | "crm_handoff"
  | "calendar_link"
  | "deal_size";

export type TileGlyph =
  | "unplug"
  | "credit-card"
  | "check-square"
  | "message-square"
  | "user-round"
  | "calendar-check"
  | "play"
  | "sliders"
  | "pen-line"
  | "plug"
  | "link"
  | "dollar-sign";

export interface ActionTileSpec {
  kind: TileKind;
  priority: 0 | 1 | 2 | 3 | 4;
  tone: TileTone;
  glyph: TileGlyph;
  title: string;
  /** Meta line; `‹…›` fragments are rendered mono by the component. */
  meta: string;
  href: string;
  /** dismissible one-time asks (P3/P4) */
  dismissible: boolean;
  /** an inline action (engine resume, deal-size form), not a navigation */
  inline?: "resume" | "deal_size";
}

export interface TileExtras {
  /** the top draft's score + the first open send slot, for the Drafts tile meta */
  topScore: number | null;
  topDraftLocation: string | null;
  topDraftSender: string | null;
  /** a thread the agent handed over (lead_notifications.needs_human, unread) */
  needsHuman: { leadId: string; name: string; company: string | null } | null;
  /** a meeting happening today */
  meetingToday: { leadId: string; name: string; company: string | null; at: string; bookedAt: string | null } | null;
  /** open suggestions from the two learning loops (tables land with the Playbook blueprint) */
  playbookSuggestion: { id: string; meta: string } | null;
  styleSuggestion: { id: string; meta: string } | null;
  /** once-per-account asks */
  crmHandoff: { leadName: string } | null;
  calendarLink: { leadName: string } | null;
  /** {kind: iso} from user_profiles.dismissed_asks */
  dismissedAsks: Record<string, string>;
  /** accounts.avg_deal_value_cents — null until set; drives the deal-size ask */
  avgDealValueCents: number | null;
  /** all-time replies count (the ask waits for the first reply) */
  repliesTotal: number;
  /** the session user is an owner/admin of the account (admin-only asks) */
  isAdmin: boolean;
}

export const MAX_TILES = 4;
const PER_ROW = 3;

/** Tile kinds that may be dismissed (hidden for the day). */
const DISMISSIBLE: ReadonlySet<TileKind> = new Set(["playbook_suggestion", "style_memory", "crm_handoff", "calendar_link", "deal_size"]);

/** A dismissed ask stays hidden for the day; a new trigger is a new day. */
function dismissedToday(kind: TileKind, dismissed: Record<string, string>, now: Date): boolean {
  const at = dismissed[kind];
  if (!at) return false;
  return now.getTime() - new Date(at).getTime() < 24 * 3_600_000;
}

// ── engine blockers (shared with lib/engine/blockers.ts — the Approvals blockers stack) ──

/** P0: one repair tile per down sender (disconnected → reconnect, restricted → open). */
export function senderRepairTiles(senders: SenderFacts[], draftsHeld: number, tz: string): ActionTileSpec[] {
  return downSenders(senders).map((s) =>
    s.status === "disconnected"
      ? {
          kind: "sender_disconnected" as const,
          priority: 0 as const,
          tone: "attention" as const,
          glyph: "unplug" as const,
          title: `Reconnect ${s.name}`,
          meta: `dropped ‹${s.statusChangedAt ? fmtTime(new Date(s.statusChangedAt), tz) : "recently"}› · ‹${draftsHeld}› drafts held`,
          href: `/settings/senders#${s.id}`,
          dismissible: false,
        }
      : {
          kind: "sender_restricted" as const,
          priority: 0 as const,
          tone: "attention" as const,
          glyph: "unplug" as const,
          title: `${s.name} is restricted by LinkedIn`,
          meta: "sending paused · approvals stay open",
          href: `/settings/senders#${s.id}`,
          dismissible: false,
        }
  );
}

/** P0: the failed payment, or null when billing is fine. */
export function paymentFailedTile(billing: TodayInputs["billing"], now: Date, tz: string): ActionTileSpec | null {
  if (billing.status !== "past_due") return null;
  const since = billing.pastDueSince ? new Date(billing.pastDueSince) : now;
  const pauses = new Date(since.getTime() + 7 * 86_400_000);
  return {
    kind: "payment_failed",
    priority: 0,
    tone: "billing",
    glyph: "credit-card",
    title: "Update payment",
    meta: `failed ‹${fmtDate(since, tz)}› · sending pauses ‹${fmtDate(pauses, tz)}›`,
    href: "/settings/billing",
    dismissible: false,
  };
}

/** P1: no LinkedIn connected yet. A workspace that never connected is not "stopped" (state.ts
 *  keeps zero senders steady — sourcing runs either way), but sending can't start until it does. */
export function senderMissingTile(): ActionTileSpec {
  return {
    kind: "sender_missing",
    priority: 1,
    tone: "attention",
    glyph: "plug",
    title: "No LinkedIn connected yet",
    meta: "Your agent is finding prospects. Connect to start sending.",
    href: "/settings/senders",
    dismissible: false,
  };
}

/** P2: the user's own pause, with the inline resume. */
export function enginePausedTile(pausedAt: string, tz: string): ActionTileSpec {
  return {
    kind: "engine_paused",
    priority: 2,
    tone: "routine",
    glyph: "play",
    title: "Resume the engine",
    meta: `paused by you ‹${fmtTime(new Date(pausedAt), tz)}› · approvals still open`,
    href: "#resume",
    dismissible: false,
    inline: "resume",
  };
}

export function tilesFor(i: TodayInputs, x: TileExtras): ActionTileSpec[] {
  const tiles: ActionTileSpec[] = [];
  const tz = i.timeZone;

  // P0 — repairs (one tile per down sender, the cheaper repair first)
  tiles.push(...senderRepairTiles(i.senders, i.draftsHeld, tz));
  const payment = paymentFailedTile(i.billing, i.now, tz);
  if (payment) tiles.push(payment);

  // P1 — the work. A workspace that never connected LinkedIn is not "stopped" (state.ts keeps
  // zero senders steady — sourcing runs either way), but sending can't start until it does.
  if (i.senders.length === 0) tiles.push(senderMissingTile());
  if (i.drafts > 0) {
    const slot = nextSendWindow(i.now, x.topDraftLocation);
    const sends = slot.openNow ? fmtWindow(slot.startsAt, slot.endsAt, tz) : `${slot.dayLabel} ${fmtTime(slot.startsAt, tz)}`;
    const sender = x.topDraftSender ?? healthySenders(i.senders)[0]?.name ?? null;
    tiles.push({
      kind: "drafts",
      priority: 1,
      tone: "routine",
      glyph: "check-square",
      title: i.drafts === 1 ? "Approve 1 draft" : `Approve ${i.drafts} drafts`,
      meta: [
        x.topScore !== null ? `top score ‹${x.topScore}›` : null,
        `first sends ‹${sends}›${sender ? ` via ${sender}` : ""}`,
      ]
        .filter(Boolean)
        .join(" · "),
      href: "/approvals",
      dismissible: false,
    });
  }
  if (i.repliesWaiting > 0) {
    tiles.push({
      kind: "replies",
      priority: 1,
      tone: "replies",
      glyph: "message-square",
      title: i.repliesWaiting === 1 ? "1 reply waiting" : `${i.repliesWaiting} replies waiting`,
      meta: `‹${i.repliesInterestedWaiting}› interested${
        i.oldestWaitingAt ? ` · oldest ‹${fmtRelative(new Date(i.oldestWaitingAt), i.now)}›` : ""
      }`,
      href: "/inbox?filter=waiting",
      dismissible: false,
    });
  }

  // P2 — specific threads + the pause
  if (x.needsHuman) {
    tiles.push({
      kind: "needs_human",
      priority: 2,
      tone: "attention",
      glyph: "user-round",
      title: `${x.needsHuman.name} needs you`,
      meta: `the agent reached its conversation limit${x.needsHuman.company ? ` · ${x.needsHuman.company}` : ""}`,
      href: `/inbox?lead=${x.needsHuman.leadId}`,
      dismissible: false,
    });
  }
  if (x.meetingToday) {
    tiles.push({
      kind: "meeting_today",
      priority: 2,
      tone: "routine",
      glyph: "calendar-check",
      title: `Meeting with ${x.meetingToday.name} at ‹${fmtTime(new Date(x.meetingToday.at), tz)}›`,
      meta: `${x.meetingToday.company ?? "—"}${
        x.meetingToday.bookedAt ? ` · booked ‹${fmtRelative(new Date(x.meetingToday.bookedAt), i.now)} ago›` : ""
      }`,
      href: `/inbox?lead=${x.meetingToday.leadId}`,
      dismissible: false,
    });
  }
  if (i.pausedAt) tiles.push(enginePausedTile(i.pausedAt, tz));

  // P3/P4 — asks, one slot each, once per day, dismissible
  const asks: ActionTileSpec[] = [];
  if (x.playbookSuggestion) {
    asks.push({
      kind: "playbook_suggestion",
      priority: 3,
      tone: "routine",
      glyph: "sliders",
      title: "Playbook suggestion",
      meta: x.playbookSuggestion.meta,
      href: `/playbook?suggestion=${x.playbookSuggestion.id}`,
      dismissible: true,
    });
  }
  if (x.styleSuggestion) {
    asks.push({
      kind: "style_memory",
      priority: 3,
      tone: "routine",
      glyph: "pen-line",
      title: "Your edits show a pattern",
      meta: x.styleSuggestion.meta,
      href: `/playbook?tab=rules&suggestion=${x.styleSuggestion.id}`,
      dismissible: true,
    });
  }
  const dealSize = dealSizeTile(x.avgDealValueCents, x.repliesTotal, x.isAdmin);
  if (dealSize) asks.push(dealSize);
  if (x.crmHandoff) {
    asks.push({
      kind: "crm_handoff",
      priority: 4,
      tone: "routine",
      glyph: "plug",
      title: "Route wins to your CRM",
      meta: `${x.crmHandoff.leadName} reached Conversation · HubSpot, Salesforce, or GoHighLevel, one time`,
      href: "/settings/integrations",
      dismissible: true,
    });
  }
  if (x.calendarLink) {
    asks.push({
      kind: "calendar_link",
      priority: 4,
      tone: "routine",
      glyph: "link",
      title: "Add a booking link",
      meta: `${x.calendarLink.leadName} asked for a time · paste it once, the agent uses it`,
      href: "/settings#booking-link",
      dismissible: true,
    });
  }

  // Asks fill only a free slot in the FIRST row, never push the row to wrap, never repeat a
  // kind, and stay hidden for the day once dismissed.
  const out = dedupe(tiles).sort((a, b) => a.priority - b.priority);
  for (const ask of asks.sort((a, b) => a.priority - b.priority)) {
    if (out.length >= PER_ROW) break;
    if (dismissedToday(ask.kind, x.dismissedAsks, i.now)) continue;
    if (out.some((t) => t.kind === ask.kind)) continue;
    out.push(ask);
  }
  return out.slice(0, MAX_TILES).map((t) => ({ ...t, dismissible: DISMISSIBLE.has(t.kind) }));
}

function dedupe(tiles: ActionTileSpec[]): ActionTileSpec[] {
  const seen = new Set<string>();
  return tiles.filter((t) => {
    const key = t.kind === "sender_disconnected" || t.kind === "sender_restricted" ? `${t.kind}:${t.href}` : t.kind;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** An ask answered by a form on its own tile (the deal-size input) — never mirrored into the
 *  primary/greeting button, which can only navigate or resume. */
export function isInlineForm(tile: ActionTileSpec): boolean {
  return tile.inline === "deal_size";
}

/** The primary (ink) button mirrors the top tile (skipping inline-form asks); hidden when
 *  nothing is left. */
export function primaryFor(tiles: ActionTileSpec[]): { label: string; count: number | null; href: string; inline?: "resume" } | null {
  const top = tiles.find((t) => !isInlineForm(t));
  if (!top) return null;
  switch (top.kind) {
    case "drafts":
      return { label: "Open queue", count: Number(/\d+/.exec(top.title)?.[0] ?? 0) || null, href: "/approvals" };
    case "replies":
      return { label: "Open inbox", count: Number(/\d+/.exec(top.title)?.[0] ?? 0) || null, href: "/inbox?filter=waiting" };
    case "sender_disconnected":
      return { label: top.title, count: null, href: top.href };
    case "sender_restricted":
      return { label: "Open sender", count: null, href: top.href };
    case "sender_missing":
      return { label: "Connect LinkedIn", count: null, href: top.href };
    case "payment_failed":
      return { label: "Update payment", count: null, href: top.href };
    case "engine_paused":
      return { label: "Resume engine", count: null, href: top.href, inline: "resume" };
    default:
      return { label: top.title, count: null, href: top.href };
  }
}

/** `tilesFor` helper for tests: a healthy sender fixture. */
export function senderFixture(over: Partial<SenderFacts> = {}): SenderFacts {
  return {
    id: "s1",
    name: "Anna K.",
    status: "active",
    ageDays: 40,
    invitesToday: 0,
    messagesToday: 0,
    invitesThisWeek: 0,
    statusChangedAt: null,
    ...over,
  };
}
