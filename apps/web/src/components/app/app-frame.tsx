"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Wash } from "@/components/today";
import { cn } from "@/lib/utils";
import { shellRoute } from "./shell-route";

/**
 * The app shell's frame. It reads the route on the client: the (app) layout persists across
 * navigation, so classes derived from the request path would stay stuck on the first page
 * loaded (e.g. Today inheriting Approvals' fixed-height, overflow-hidden frame and clipping
 * the work card).
 *
 * Bottom padding clears the fixed chrome: the mobile tab bar (h-14 + safe area) and the
 * copilot launcher (bottom-20 on mobile, bottom-6 on desktop).
 */
export function AppFrame({
  className,
  top,
  banners,
  children,
  overlays,
}: {
  className?: string;
  /** Chrome and session plumbing rendered above <main>. */
  top: ReactNode;
  /** App-wide strips; Today owns its own banner slot, so they are hidden there. */
  banners: ReactNode;
  children: ReactNode;
  /** Toaster, copilot. */
  overlays: ReactNode;
}) {
  const { onToday, oneScreen } = shellRoute(usePathname());
  return (
    <div
      className={cn(
        "relative flex flex-col bg-[var(--canvas)]",
        oneScreen ? "min-h-screen lg:h-dvh lg:max-h-dvh" : "min-h-screen",
        className
      )}
    >
      {onToday && <Wash />}
      {top}
      {/* min-w-0 + overflow-x-clip: no surface can produce a sideways-scrolling page. */}
      <main
        className={cn(
          "flex min-w-0 flex-col overflow-x-clip px-4 pb-[calc(9rem+env(safe-area-inset-bottom))] sm:px-6 lg:pb-20",
          onToday ? "min-h-min" : "min-h-0 flex-1 pt-8 lg:pt-[72px]",
          oneScreen && "lg:overflow-hidden"
        )}
      >
        {!onToday && banners}
        {children}
      </main>
      {overlays}
    </div>
  );
}
