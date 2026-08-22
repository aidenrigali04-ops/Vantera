"use client";

import { Search, Settings } from "lucide-react";
import type { AppNotification } from "@/components/notifications/notifications-bell";
import { cn } from "@/lib/utils";
import { BellTile } from "./bell-tile";
import { openCommandPalette } from "./command-palette";
import { UtilityTile } from "./utility-tile";

/** Search · bell · settings, 6px apart. The 24px gap to the avatar belongs to the band. */
export function UtilityCluster({
  notifications,
  className,
}: {
  notifications: AppNotification[];
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <UtilityTile label="Search" title="Search · ⌘K" icon={Search} onClick={openCommandPalette} />
      <BellTile notifications={notifications} />
      <UtilityTile label="Settings" href="/settings" icon={Settings} />
    </div>
  );
}
