"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, CheckCircle2, Flame, MessageSquare, Snowflake, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { markNotificationsRead } from "./actions";

export type AppNotification = {
  id: string;
  kind: "reply" | "converted" | "exhausted" | "hot_signal";
  who: string;
  verb: string;
  at: string;
  href: string;
};

const KIND_ICON: Record<AppNotification["kind"], LucideIcon> = {
  reply: MessageSquare,
  converted: CheckCircle2,
  exhausted: Snowflake,
  hot_signal: Flame,
};

// Brand badge per event: a win is green (success), cold is muted, replies + hot signals
// glow cyan. Sits on the corner of each prospect's avatar.
const KIND_BADGE: Record<AppNotification["kind"], string> = {
  reply: "bg-[var(--cyan)] text-white",
  hot_signal: "bg-[var(--cyan)] text-white",
  converted: "bg-[var(--positive)] text-white",
  exhausted: "bg-[var(--ink-4)] text-white",
};

function initials(name: string): string {
  const parts = name.replace(/@.*/, "").split(/[.\s_-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? name[0] ?? "?") + (parts[1]?.[0] ?? "")).toUpperCase();
}

/**
 * Dock-rail notification bell — avatar notifications for unread lead events (a reply
 * paused the sequence, a lead converted, a lead went cold, a fresh buying signal).
 * Opening marks them read, so the badge is a true "needs your attention" count.
 */
export function NotificationsBell({ notifications }: { notifications: AppNotification[] }) {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(notifications.length);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
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
    setOpen(next);
    if (next && notifications.length > 0) {
      setUnread(0);
      void markNotificationsRead(notifications.map((n) => n.id));
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-label="Notifications"
        aria-expanded={open}
        className={cn(
          "group relative grid size-12 place-items-center rounded-xl bg-white text-foreground/70 shadow-sm ring-1 ring-[var(--hairline)] transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          open && "bg-foreground/[0.05] text-foreground"
        )}
      >
        <Bell className="size-5" strokeWidth={2.1} />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 grid min-w-[18px] place-items-center rounded-full bg-[var(--cyan)] px-1 text-[10px] font-semibold leading-[18px] text-white ring-2 ring-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute left-full top-0 z-50 ml-3 w-80 rounded-2xl border border-[var(--hairline)] bg-white p-2 shadow-[var(--shadow-lift)]">
          <p className="px-2 py-1.5 text-[11px] uppercase tracking-[0.18em] text-[var(--ink-4)]">
            Notifications
          </p>
          {notifications.length === 0 ? (
            <p className="px-2 py-6 text-center text-sm text-muted-foreground">You&apos;re all caught up.</p>
          ) : (
            <ul className="max-h-80 overflow-y-auto">
              {notifications.map((n) => {
                const Icon = KIND_ICON[n.kind];
                return (
                  <li key={n.id}>
                    <Link
                      href={n.href}
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-[var(--cyan-tint)]/50"
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
        </div>
      )}
    </div>
  );
}
