"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bot,
  Inbox,
  LayoutDashboard,
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
// destination with in-page tabs; Leads (Surface A) is the daily opportunity feed. Pipeline and
// Analytics tiles were removed — their routes redirect into Results' tabs.
const MAIN: NavItem[] = [
  { key: "dashboard", href: "/dashboard", label: "Results", icon: LayoutDashboard },
  { key: "agents", href: "/agents", label: "System", icon: Bot },
  { key: "leads", href: "/leads", label: "Leads", icon: Users },
  { key: "review", href: "/review", label: "Review", icon: Inbox },
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
