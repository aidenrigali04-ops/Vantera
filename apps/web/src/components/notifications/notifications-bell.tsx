"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Bell, CalendarCheck2, CheckCircle2, Flame, MessageSquare, Snowflake, UserRound, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { markNotificationsRead } from "./actions";

export type AppNotification = {
  id: string;
  kind: "reply" | "converted" | "exhausted" | "hot_signal" | "needs_human" | "meeting_booked";
  who: string;
  verb: string;
  at: string;
  href: string;
  unread: boolean;
};

const KIND_ICON: Record<AppNotification["kind"], LucideIcon> = {
  reply: MessageSquare,
  converted: CheckCircle2,
  exhausted: Snowflake,
  hot_signal: Flame,
  needs_human: UserRound,
  meeting_booked: CalendarCheck2,
};

// Brand badge per event: a win is green (success), cold is muted, replies + hot signals
// glow cyan. Sits on the corner of each prospect's avatar.
const KIND_BADGE: Record<AppNotification["kind"], string> = {
  reply: "bg-[var(--cyan)] text-white",
  hot_signal: "bg-[var(--cyan)] text-white",
  converted: "bg-[var(--positive)] text-white",
  exhausted: "bg-[var(--ink-4)] text-white",
  // amber = attention: the agent stepped aside and this thread is waiting on the human
  needs_human: "bg-amber-500 text-white",
  meeting_booked: "bg-[var(--positive)] text-white",
};

function initials(name: string): string {
  const parts = name.replace(/@.*/, "").split(/[.\s_-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? name[0] ?? "?") + (parts[1]?.[0] ?? "")).toUpperCase();
}

/**
 * Dock-rail notification bell — avatar notifications for lead events (a reply landed, a
 * lead converted, a lead went cold, a fresh buying signal, a thread needs the human).
 *
 * The overlay renders through a PORTAL with fixed positioning: the dock rail scrolls
 * (overflow-y-auto), and an overflow container clips absolutely-positioned children —
 * the old in-place popover opened invisibly behind it (the "clicking does nothing" bug).
 * Each item deep-links to the exact lead/page the event lives on. Opening marks only the
 * unread items read; the feed keeps recent history so the click is always rewarded.
 */
export function NotificationsBell({ notifications }: { notifications: AppNotification[] }) {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(notifications.filter((n) => n.unread).length);
  const [seen, setSeen] = useState<Set<string>>(new Set());
  const [anchor, setAnchor] = useState<{ top: number; left: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      const t = e.target as Node;
      if (!panelRef.current?.contains(t) && !buttonRef.current?.contains(t)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function toggle() {
    const next = !open;
    if (next && buttonRef.current) {
      const r = buttonRef.current.getBoundingClientRect();
      // clamp so a bell low in the rail never pushes the panel off-screen
      setAnchor({ top: Math.min(r.top, window.innerHeight - 420), left: r.right + 12 });
    }
    setOpen(next);
    const unreadIds = notifications.filter((n) => n.unread && !seen.has(n.id)).map((n) => n.id);
    if (next && unreadIds.length > 0) {
      setUnread(0);
      setSeen((s) => new Set([...s, ...unreadIds]));
      void markNotificationsRead(unreadIds);
    }
  }

  const isUnread = (n: AppNotification) => n.unread && !seen.has(n.id);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={toggle}
        aria-label="Notifications"
        aria-expanded={open}
        className={cn(
          "group relative grid size-12 place-items-center rounded-xl bg-[var(--nav-tile)] text-[var(--nav-fg)] ring-1 ring-[var(--nav-line)] transition-colors hover:bg-[var(--nav-tile-hover)] hover:text-[var(--nav-fg-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70",
          open && "bg-white text-[var(--nav-ink)]"
        )}
      >
        <Bell className="size-5" strokeWidth={2.1} />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 grid min-w-[18px] place-items-center rounded-full bg-foreground px-1 text-[10px] font-semibold leading-[18px] text-background ring-2 ring-[var(--nav-bg-solid)]">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open &&
        anchor &&
        createPortal(
          <div
            ref={panelRef}
            style={{ top: anchor.top, left: anchor.left }}
            className="fixed z-50 w-80 rounded-2xl border border-[var(--hairline)] bg-white p-2 shadow-[var(--shadow-lift)]"
          >
            <p className="px-2 py-1.5 text-[11px] uppercase tracking-[0.18em] text-[var(--ink-4)]">
              Notifications
            </p>
            {notifications.length === 0 ? (
              <p className="px-2 py-6 text-center text-sm text-muted-foreground">
                Nothing yet — lead events show up here as they happen.
              </p>
            ) : (
              <ul className="max-h-96 overflow-y-auto">
                {notifications.map((n) => {
                  const Icon = KIND_ICON[n.kind];
                  return (
                    <li key={n.id}>
                      <Link
                        href={n.href}
                        onClick={() => setOpen(false)}
                        className={cn(
                          "flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-[var(--cyan-tint)]/50",
                          isUnread(n) && "bg-[var(--cyan-tint)]/35"
                        )}
                      >
                        <span className="relative shrink-0">
                          <span className="grid size-9 place-items-center rounded-full bg-foreground/[0.06] text-[12px] font-semibold text-[var(--ink-2)]">
                            {initials(n.who)}
                          </span>
                          <span
                            className={cn(
                              "absolute -bottom-0.5 -right-0.5 grid size-4 place-items-center rounded-full ring-2 ring-white",
                              KIND_BADGE[n.kind]
                            )}
                          >
                            <Icon className="size-2.5" />
                          </span>
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2">
                            <span className="truncate text-sm font-medium text-foreground">{n.who}</span>
                            {isUnread(n) && (
                              <span aria-label="unread" className="size-1.5 shrink-0 rounded-full bg-[var(--cyan-strong)]" />
                            )}
                            <span className="ml-auto shrink-0 text-[10px] text-[var(--ink-4)]">{n.at}</span>
                          </span>
                          <span className="line-clamp-1 text-xs text-muted-foreground">{n.verb}</span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>,
          document.body
        )}
    </>
  );
}
