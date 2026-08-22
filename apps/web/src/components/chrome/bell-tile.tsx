"use client";

import { useCallback, useId, useRef, useState } from "react";
import Link from "next/link";
import {
  Bell,
  CalendarCheck2,
  CircleCheck,
  Flame,
  MessageSquare,
  Snowflake,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { markNotificationsRead } from "@/components/notifications/actions";
import type { AppNotification } from "@/components/notifications/notifications-bell";
import { initialsFrom } from "./initials";
import { CHROME_FOCUS, CHROME_MENU, CHROME_MOTION, CHROME_TILE } from "./tile";
import { useDismiss, type DismissReason } from "./use-dismiss";

const KIND_ICON: Record<AppNotification["kind"], LucideIcon> = {
  reply: MessageSquare,
  converted: CircleCheck,
  exhausted: Snowflake,
  hot_signal: Flame,
  needs_human: UserRound,
  meeting_booked: CalendarCheck2,
};

// Color only for meaning (§5): replies + signals are accent, wins are positive, a thread
// waiting on the human is attention, a cold prospect is muted.
const KIND_TONE: Record<AppNotification["kind"], string> = {
  reply: "bg-[var(--acc)]",
  hot_signal: "bg-[var(--acc)]",
  converted: "bg-[var(--positive)]",
  meeting_booked: "bg-[var(--positive)]",
  needs_human: "bg-[var(--attention)]",
  exhausted: "bg-[var(--ink-dim)]",
};

/**
 * Notification bell as a 40px chrome tile with its feed hanging below-right. Same feed
 * semantics as the rail-era `NotificationsBell` (same `AppNotification` rows, same
 * `markNotificationsRead` action, opening marks only the unread items read, recent history
 * stays so the click is always rewarded) — rebuilt here because that component portals its
 * panel to `document.body` at `left: button.right + 12px` with inline styles, which no
 * wrapper CSS can reposition under a top band. The band has no overflow clipping, so a
 * plain absolutely-positioned panel is enough.
 */
export function BellTile({ notifications, className }: { notifications: AppNotification[]; className?: string }) {
  const [open, setOpen] = useState(false);
  // ids already reported read this session (count drops immediately) …
  const [seen, setSeen] = useState<Set<string>>(() => new Set());
  // … and the ones marked on THIS open, which keep their unread styling until the panel
  // closes so the person can see what was new.
  const [fresh, setFresh] = useState<Set<string>>(() => new Set());
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  const unread = notifications.filter((n) => n.unread && !seen.has(n.id)).length;
  const isUnread = (n: AppNotification) => n.unread && (!seen.has(n.id) || fresh.has(n.id));

  const close = useCallback((restoreFocus: boolean) => {
    setOpen(false);
    if (restoreFocus) buttonRef.current?.focus();
  }, []);

  const onDismiss = useCallback((reason: DismissReason) => close(reason === "escape"), [close]);
  useDismiss(open, rootRef, onDismiss);

  function toggle() {
    if (open) {
      close(false);
      return;
    }
    const ids = notifications.filter((n) => n.unread && !seen.has(n.id)).map((n) => n.id);
    setFresh(new Set(ids));
    if (ids.length > 0) {
      setSeen((prev) => new Set([...prev, ...ids]));
      void markNotificationsRead(ids);
    }
    setOpen(true);
  }

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        ref={buttonRef}
        type="button"
        onClick={toggle}
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        title="Notifications"
        className={cn(
          CHROME_TILE,
          "relative text-[var(--ink-mid)] hover:text-[var(--ink)]",
          open && "text-[var(--ink)] ring-[var(--line-strong)]"
        )}
      >
        <Bell className="size-4.5" strokeWidth={1.75} aria-hidden="true" />
        {unread > 0 && (
          <span
            aria-hidden="true"
            className="absolute -right-1 -top-1 grid h-[18px] min-w-[18px] place-items-center rounded-[var(--r-pill)] bg-[var(--ink)] px-1 font-mono text-[10px] font-semibold leading-none text-[var(--ink-fg)] ring-2 ring-[var(--surface)]"
          >
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          id={panelId}
          role="dialog"
          aria-label="Notifications"
          className={cn(CHROME_MENU, "right-0 w-[min(20rem,calc(100vw-2rem))] p-1.5")}
        >
          <p className="px-2.5 pb-1.5 pt-1 text-xs font-medium text-[var(--ink-dim)]">Notifications</p>
          {notifications.length === 0 ? (
            <p className="px-2.5 py-6 text-center text-sm text-[var(--ink-mid)]">
              Nothing yet — prospect events show up here as they happen.
            </p>
          ) : (
            <ul className="max-h-96 overflow-y-auto">
              {notifications.map((n) => {
                const Icon = KIND_ICON[n.kind];
                const isNew = isUnread(n);
                return (
                  <li key={n.id}>
                    <Link
                      href={n.href}
                      onClick={() => close(false)}
                      className={cn(
                        "flex items-center gap-3 rounded-[var(--r-btn)] px-2 py-2 hover:bg-[var(--surface-2)]",
                        CHROME_MOTION,
                        CHROME_FOCUS
                      )}
                    >
                      <span className="relative shrink-0">
                        <span className="grid size-9 place-items-center rounded-full bg-[var(--surface-2)] font-mono text-xs font-semibold text-[var(--ink-mid)]">
                          {initialsFrom(n.who, "?")}
                        </span>
                        <span
                          className={cn(
                            "absolute -bottom-0.5 -right-0.5 grid size-4 place-items-center rounded-full text-[var(--ink-fg)] ring-2 ring-[var(--surface)]",
                            KIND_TONE[n.kind]
                          )}
                        >
                          <Icon className="size-2.5" strokeWidth={2} aria-hidden="true" />
                        </span>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className={cn("truncate text-sm text-[var(--ink)]", isNew ? "font-semibold" : "font-medium")}>
                            {n.who}
                          </span>
                          {isNew && (
                            <span
                              role="img"
                              aria-label="Unread"
                              className="size-1.5 shrink-0 rounded-full bg-[var(--acc)]"
                            />
                          )}
                          <span className="ml-auto shrink-0 font-mono text-[11px] text-[var(--ink-dim)]">{n.at}</span>
                        </span>
                        <span className="line-clamp-1 text-xs text-[var(--ink-mid)]">{n.verb}</span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
