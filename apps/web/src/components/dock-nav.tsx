"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bot,
  CalendarCheck2,
  Inbox,
  LayoutDashboard,
  MessagesSquare,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Icons live in this client module — component objects can't be serialized from
// a server component (RSC). Badge counts ARE serializable, so the server layout
// passes them in by key.
type NavItem = { key: string; href: string; label: string; icon: LucideIcon };

// Results (Surface B) consolidates the former Dashboard + Pipeline + Analytics into one
// destination with in-page tabs; Prospects (Surface A) is the daily opportunity feed. Pipeline and
// Analytics tiles were removed — their routes redirect into Results' tabs.
const MAIN: NavItem[] = [
  { key: "dashboard", href: "/dashboard", label: "Results", icon: LayoutDashboard },
  { key: "agents", href: "/playbook", label: "Playbook", icon: Bot },
  { key: "leads", href: "/prospects", label: "Prospects", icon: Users },
  { key: "review", href: "/approvals", label: "Approvals", icon: Inbox },
  // L2 cockpit: every conversation, both sides, one place.
  { key: "inbox", href: "/inbox", label: "Inbox", icon: MessagesSquare },
  // L1 meeting layer: the destination the whole funnel points at — booked meetings, visible.
  { key: "meetings", href: "/meetings", label: "Meetings", icon: CalendarCheck2 },
];

const SECONDARY: NavItem[] = [
  { key: "settings", href: "/settings", label: "Settings", icon: Settings },
];

export function DockNav({ badges }: { badges?: Record<string, number> }) {
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  return (
    // Top-aligned in the rail; the account cluster is pushed to the bottom by
    // the shell (mt-auto). Never grow/center here, or the pill drifts mid-page.
    <nav className="flex flex-col items-center">
      {/* The dock pill — vertical (top-to-bottom) restructure of the source's
          horizontal rail; same rounded, blurred, ringed container. */}
      <div className="flex flex-col items-center gap-3 px-2 py-1">
        {MAIN.map((item) => (
          <DockTile
            key={item.key}
            item={item}
            active={isActive(item.href)}
            badge={badges?.[item.key]}
          />
        ))}
        <span className="my-1 h-px w-6 bg-[var(--nav-line)]" aria-hidden="true" />
        {SECONDARY.map((item) => (
          <DockTile key={item.key} item={item} active={isActive(item.href)} />
        ))}
      </div>
    </nav>
  );
}

function DockTile({
  item,
  active,
  badge,
}: {
  item: NavItem;
  active: boolean;
  badge?: number;
}) {
  const { icon: Icon, label, href } = item;
  return (
    <Link
      href={href}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative grid size-12 place-items-center rounded-xl ring-1 transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:outline-none",
        active
          ? "bg-white text-[var(--nav-ink)] shadow-sm ring-white/0"
          : "bg-[var(--nav-tile)] text-[var(--nav-fg)] ring-[var(--nav-line)] hover:bg-[var(--nav-tile-hover)] hover:text-[var(--nav-fg-strong)]",
      )}
    >
      <Icon className="size-5" strokeWidth={active ? 2.4 : 2.1} />
      {badge ? (
        <span className="absolute -top-1.5 -right-1.5 grid size-5 place-items-center rounded-full bg-foreground text-[10px] font-semibold text-background ring-2 ring-[var(--nav-bg-solid)]">
          {badge > 99 ? "99+" : badge}
        </span>
      ) : null}
      <DockTooltip>{label}</DockTooltip>
    </Link>
  );
}

// Tooltip moved to the right edge (the source's sat below a horizontal dock).
export function DockTooltip({ children }: { children: React.ReactNode }) {
  return (
    <span className="pointer-events-none absolute top-1/2 left-full z-10 ml-3 -translate-y-1/2 translate-x-1 rounded-md bg-foreground px-2 py-1 text-[10px] font-medium tracking-wide whitespace-nowrap text-background opacity-0 shadow-md transition duration-200 group-hover:translate-x-0 group-hover:opacity-100">
      {children}
    </span>
  );
}

/**
 * Mobile bottom nav (P2 mobile shell, 2026-07-15): the desktop rail is hidden below lg;
 * the five core destinations ride a fixed bottom bar, thumb-reachable. Settings lives in
 * the mobile top bar (layout).
 */
export function MobileNav({ badges }: { badges?: Record<string, number> }) {
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");
  return (
    <nav
      aria-label="Primary"
      className="app-rail fixed inset-x-0 bottom-0 z-40 flex items-stretch justify-around border-t border-[var(--nav-line)] pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      {MAIN.map((item) => {
        const Icon = item.icon;
        const active = isActive(item.href);
        const badge = badges?.[item.key];
        return (
          <Link
            key={item.key}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium",
              active ? "text-[var(--nav-fg-strong)]" : "text-[var(--nav-fg)]"
            )}
          >
            <Icon className="size-5" strokeWidth={2.1} />
            {item.label}
            {badge != null && badge > 0 && (
              <span className="absolute right-[22%] top-1 grid min-w-[16px] place-items-center rounded-full bg-white px-1 text-[9px] font-semibold leading-[16px] text-[var(--nav-ink)]">
                {badge > 9 ? "9+" : badge}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
