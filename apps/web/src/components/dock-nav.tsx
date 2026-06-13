"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
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

const MAIN: NavItem[] = [
  { key: "dashboard", href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "agents", href: "/agents", label: "Agents", icon: Bot },
  { key: "leads", href: "/leads", label: "Leads", icon: Users },
  { key: "review", href: "/review", label: "Review", icon: Inbox },
  { key: "analytics", href: "/analytics", label: "Analytics", icon: BarChart3 },
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
      <div className="flex flex-col items-center gap-3 rounded-[28px] border border-black/10 bg-neutral-100/70 px-2 py-3 shadow-2xl ring-1 ring-black/5 backdrop-blur-lg dark:border-white/10 dark:bg-neutral-900/80 dark:ring-white/10">
        {MAIN.map((item) => (
          <DockTile
            key={item.key}
            item={item}
            active={isActive(item.href)}
            badge={badges?.[item.key]}
          />
        ))}
        <span className="my-1 h-px w-6 bg-black/10 dark:bg-white/10" aria-hidden="true" />
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
        "dock-tile group relative grid size-12 place-items-center rounded-xl shadow-lg ring-1 backdrop-blur-xl transition-transform duration-200 hover:translate-x-0.5 hover:scale-[1.05] focus-visible:scale-[1.05] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none",
        active
          ? "bg-foreground text-background ring-foreground/20"
          : "bg-gradient-to-b from-neutral-200/70 to-neutral-300/40 text-foreground/70 ring-black/10 hover:text-foreground dark:from-neutral-800/60 dark:to-neutral-900/70 dark:text-white/85 dark:ring-white/10 dark:hover:text-white",
      )}
    >
      <Icon
        className="size-5 transition-transform duration-200 group-hover:scale-110"
        strokeWidth={2.1}
      />
      {badge ? (
        <span className="absolute -top-1.5 -right-1.5 grid size-5 place-items-center rounded-full bg-foreground text-[10px] font-semibold text-background ring-2 ring-background">
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
