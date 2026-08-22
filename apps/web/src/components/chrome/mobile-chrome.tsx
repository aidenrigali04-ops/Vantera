"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Ellipsis, Inbox, SquareCheck, Sun, type LucideIcon } from "lucide-react";
import { VanteraLogo } from "@/components/landing/vantera-logo";
import type { AppNotification } from "@/components/notifications/notifications-bell";
import { cn } from "@/lib/utils";
import { AvatarTile, type AvatarTileProps } from "./avatar-tile";
import { BellTile } from "./bell-tile";
import { openCommandPalette } from "./command-palette";
import { badgeFor, formatBadge, isActivePath, type NavBadges, type NavKey } from "./nav-items";
import { CHROME_FOCUS, CHROME_MOTION } from "./tile";

const MOBILE_TABS: readonly { key: NavKey; label: string; href: string; icon: LucideIcon }[] = [
  { key: "today", label: "Today", href: "/today", icon: Sun },
  { key: "approvals", label: "Approvals", href: "/approvals", icon: SquareCheck },
  { key: "inbox", label: "Inbox", href: "/inbox", icon: Inbox },
];

export type MobileChromeProps = {
  workspaceName: string;
  paused?: boolean;
  badges?: NavBadges;
  notifications: AppNotification[];
  account: Omit<AvatarTileProps, "signOut">;
  signOut: () => Promise<void>;
};

const TAB_CLASS = cn(
  "relative flex flex-col items-center justify-center gap-1 text-[11px] font-medium",
  CHROME_MOTION,
  CHROME_FOCUS
);

/**
 * Below `lg`: a 48px top bar (logo · workspace · bell · avatar) and a fixed 56px bottom tab
 * bar (Today · Approvals · Inbox · More) that respects the home-indicator safe area. "More"
 * opens the command palette, which carries every other destination.
 */
export function MobileChrome({ workspaceName, paused = false, badges, notifications, account, signOut }: MobileChromeProps) {
  const pathname = usePathname();

  return (
    <>
      <div className="sticky top-0 z-40 flex h-12 items-center gap-3 border-b border-[var(--line)] bg-[var(--surface)] px-4 lg:hidden">
        <Link
          href="/today"
          aria-label="Vantera home"
          className={cn("grid size-8 shrink-0 place-items-center rounded-[var(--r-btn)] text-[var(--ink)]", CHROME_FOCUS)}
        >
          <VanteraLogo className="size-4.5" />
        </Link>
        <span className="flex min-w-0 flex-1 items-center gap-1.5">
          {paused && (
            <span
              role="img"
              aria-label="Engine paused"
              title="Engine paused"
              className="size-1.5 shrink-0 rounded-full bg-[var(--attention)]"
            />
          )}
          <span className="truncate text-sm font-medium text-[var(--ink)]">{workspaceName}</span>
        </span>
        <div className="flex shrink-0 items-center gap-1.5">
          <BellTile notifications={notifications} />
          <AvatarTile {...account} signOut={signOut} />
        </div>
      </div>

      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--line)] bg-[var(--surface)] pb-[env(safe-area-inset-bottom)] lg:hidden"
      >
        <div className="grid h-14 grid-cols-4">
          {MOBILE_TABS.map(({ key, label, href, icon: Icon }) => {
            const active = isActivePath(pathname, href);
            const badgeText = formatBadge(badgeFor(badges, key));
            return (
              <Link
                key={key}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(TAB_CLASS, active ? "text-[var(--acc-ink)]" : "text-[var(--ink-mid)]")}
              >
                <span className="relative">
                  <Icon className="size-5" strokeWidth={1.75} aria-hidden="true" />
                  {badgeText && (
                    <span className="absolute -right-2.5 -top-1.5 grid h-4 min-w-4 place-items-center rounded-[var(--r-pill)] bg-[var(--ink)] px-1 font-mono text-[10px] font-semibold leading-none text-[var(--ink-fg)] ring-2 ring-[var(--surface)]">
                      {badgeText}
                    </span>
                  )}
                </span>
                {label}
              </Link>
            );
          })}
          <button type="button" onClick={openCommandPalette} className={cn(TAB_CLASS, "text-[var(--ink-mid)]")}>
            <Ellipsis className="size-5" strokeWidth={1.75} aria-hidden="true" />
            More
          </button>
        </div>
      </nav>
    </>
  );
}
