"use client";

import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { NAV_ITEMS, badgeFor, isActivePath, type NavBadges } from "./nav-items";
import { NavTab } from "./nav-tab";
import { CHROME_PILL } from "./tile";

/** The primary nav: five tabs in one height-40 pill, active state from the pathname. */
export function NavPill({ badges, className }: { badges?: NavBadges; className?: string }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Primary" className={cn(CHROME_PILL, "gap-0.5 p-1", className)}>
      {NAV_ITEMS.map((item) => (
        <NavTab
          key={item.key}
          href={item.href}
          label={item.label}
          active={isActivePath(pathname, item.href)}
          badge={badgeFor(badges, item.key)}
        />
      ))}
    </nav>
  );
}
