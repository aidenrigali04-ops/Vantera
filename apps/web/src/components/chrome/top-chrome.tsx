"use client";

import type { AppNotification } from "@/components/notifications/notifications-bell";
import { AvatarTile } from "./avatar-tile";
import { CommandPalette } from "./command-palette";
import { LogoTile } from "./logo-tile";
import { MobileChrome } from "./mobile-chrome";
import type { NavBadges } from "./nav-items";
import { NavPill } from "./nav-pill";
import { UtilityCluster } from "./utility-cluster";
import { WorkspacePill, type EngineAction } from "./workspace-pill";

export type TopChromeProps = {
  workspaceName: string;
  /** `accounts.paused_at` is set — sourcing and sending are stopped. */
  paused: boolean;
  badges: NavBadges;
  notifications: AppNotification[];
  account: { initial: string; displayName: string | null; email: string };
  signOut: () => Promise<void>;
  pauseEngine: EngineAction;
  resumeEngine: EngineAction;
};

/**
 * The top chrome (Dashboard blueprint v1.0 §6.1 + §10): a 64px floating band that replaces
 * the sidebar rail. Desktop (`lg+`): logo + workspace pill on the left, the primary nav
 * absolutely centered so the side clusters can never push it off-center, utilities + avatar
 * on the right. Below `lg` the MobileChrome top bar + bottom tabs take over. The command
 * palette mounts once here. Props are serializable (server actions included) so the
 * server layout can render this directly.
 */
export function TopChrome({
  workspaceName,
  paused,
  badges,
  notifications,
  account,
  signOut,
  pauseEngine,
  resumeEngine,
}: TopChromeProps) {
  return (
    <>
      <header
        className={[
          "sticky top-0 z-40 hidden h-16 w-full items-center justify-between px-6 lg:flex",
          // Plain rgb() + alpha, not color-mix(): this is the one element every app page
          // depends on, and it must paint identically on every engine. The lower alpha lets
          // Today's wash read through the band instead of being masked by it.
          "bg-[rgb(246_246_247_/_0.72)] backdrop-blur-[12px] backdrop-saturate-150",
        ].join(" ")}
      >
        <div className="flex items-center gap-3">
          <LogoTile />
          <WorkspacePill name={workspaceName} paused={paused} pauseEngine={pauseEngine} resumeEngine={resumeEngine} />
        </div>

        <div className="absolute left-1/2 top-3 -translate-x-1/2">
          <NavPill badges={badges} />
        </div>

        <div className="flex items-center gap-6">
          <UtilityCluster notifications={notifications} />
          <AvatarTile initial={account.initial} displayName={account.displayName} email={account.email} signOut={signOut} />
        </div>
      </header>

      <MobileChrome
        workspaceName={workspaceName}
        paused={paused}
        badges={badges}
        notifications={notifications}
        account={account}
        signOut={signOut}
      />

      <CommandPalette />
    </>
  );
}
