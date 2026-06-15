"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, CheckCircle2, MessageSquare, Snowflake, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { markNotificationsRead } from "./actions";

export type AppNotification = {
  id: string;
  kind: "reply" | "converted" | "exhausted";
  who: string;
  verb: string;
  at: string;
  href: string;
};

const KIND_ICON: Record<AppNotification["kind"], LucideIcon> = {
  reply: MessageSquare,
  converted: CheckCircle2,
  exhausted: Snowflake,
};

/**
 * Dock-rail notification bell. Surfaces unread lead events (a reply paused the
 * sequence, a lead converted, a lead went cold). Opening marks them read, so the
 * badge is a true "needs your attention" count — not reward-free noise.
 */
export function NotificationsBell({ notifications }: { notifications: AppNotification[] }) {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(notifications.length);
  const ref = useRef<HTMLDivElement>(null);

  // close on outside click / Escape
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
          "group relative grid size-12 place-items-center rounded-xl text-foreground/70 ring-1 ring-border transition-colors hover:bg-foreground/[0.04] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          open && "bg-foreground/[0.06] text-foreground"
        )}
      >
        <Bell className="size-5" strokeWidth={2.1} />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 grid min-w-[18px] place-items-center rounded-full bg-foreground px-1 font-mono text-[10px] font-semibold leading-[18px] text-background shadow-[0_0_8px_rgba(255,255,255,0.55)]">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute left-full top-0 z-50 ml-3 w-72 rounded-2xl border border-white/[0.12] bg-background/95 p-2 shadow-lg shadow-black/30 backdrop-blur-xl dark:bg-neutral-900/95">
          <p className="px-2 py-1.5 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            Notifications
          </p>
          {notifications.length === 0 ? (
            <p className="px-2 py-6 text-center text-sm text-muted-foreground">
              You&apos;re all caught up.
            </p>
          ) : (
            <ul className="max-h-80 overflow-y-auto">
              {notifications.map((n) => {
                const Icon = KIND_ICON[n.kind];
                return (
                  <li key={n.id}>
                    <Link
                      href={n.href}
                      onClick={() => setOpen(false)}
                      className="flex items-start gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-foreground/[0.05]"
                    >
                      <span
                        className={cn(
                          "mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-foreground/10 text-muted-foreground",
                          n.kind === "converted" &&
                            "bg-foreground text-background shadow-[0_0_10px_rgba(255,255,255,0.5)]"
                        )}
                      >
                        <Icon className="size-3.5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="truncate text-sm font-medium">{n.who}</span>
                          <span className="ml-auto shrink-0 font-mono text-[10px] text-muted-foreground/70">
                            {n.at}
                          </span>
                        </span>
                        <span className="text-xs text-muted-foreground">{n.verb}</span>
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
