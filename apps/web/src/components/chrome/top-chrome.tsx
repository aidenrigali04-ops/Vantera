"use client";

import type { AppNotification } from "@/components/notifications/notifications-bell";
import type { ChipState, EngineGroups } from "@/lib/engine/chip-state";
import { AvatarTile } from "./avatar-tile";
import { CommandPalette } from "./command-palette";
import { EnginePopover, type EngineAction, type GroupAction } from "./engine-popover";
import { LogoTile } from "./logo-tile";
import { MobileChrome } from "./mobile-chrome";
import type { NavBadges } from "./nav-items";
import { NavPill } from "./nav-pill";
import { UtilityCluster } from "./utility-cluster";
import { WorkspacePill } from "./workspace-pill";

export type TopChromeProps = {
  workspaceName: string;
  /** Icon URLs to try for the workspace mark, in order; empty falls back to the glyph. */
  workspaceIconCandidates?: string[];
  /** `accounts.paused_at` is set — sourcing and sending are stopped. */
  paused: boolean;
  badges: NavBadges;
  notifications: AppNotification[];
  account: { initial: string; displayName: string | null; email: string };
  signOut: () => Promise<void>;
  /** pause / resume — wired to the status chip's popover, the one pause control */
  pauseEngine: EngineAction;
  resumeEngine: EngineAction;
  /** The run-state chip, computed on the server (`chipFor`) — serializable only. */
  chip: ChipState;
  /** The popover's Sourcing / Outreach switch states (`groupsFor`). */
  groups: EngineGroups;
  setAgentGroup: GroupAction;
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
  workspaceIconCandidates,
  paused,
  badges,
  notifications,
  account,
  signOut,
  pauseEngine,
  resumeEngine,
  chip,
  groups,
  setAgentGroup,
}: TopChromeProps) {
  const engine = { chip, groups, paused, pauseEngine, resumeEngine, setAgentGroup };
  return (
    <>
      <header
        className="sticky top-0 z-40 hidden h-16 w-full shrink-0 items-center justify-between border-b border-[var(--line)] bg-[var(--surface)]/90 px-6 backdrop-blur-md backdrop-saturate-150 lg:flex"
      >
        <div className="flex items-center gap-3">
          <LogoTile />
          <WorkspacePill name={workspaceName} iconCandidates={workspaceIconCandidates} paused={paused} />
        </div>

        <div className="absolute left-1/2 top-3 -translate-x-1/2">
          <NavPill badges={badges} />
        </div>

        <div className="flex items-center gap-3">
          <EnginePopover {...engine} />
          <UtilityCluster notifications={notifications} />
          <AvatarTile initial={account.initial} displayName={account.displayName} email={account.email} signOut={signOut} />
        </div>
      </header>

      <MobileChrome
        workspaceName={workspaceName}
        engine={engine}
        badges={badges}
        notifications={notifications}
        account={account}
        signOut={signOut}
      />

      <CommandPalette />
    </>
  );
}
