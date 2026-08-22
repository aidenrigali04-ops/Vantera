"use client";

import { AccountMenu } from "@/components/account-menu";
import { cn } from "@/lib/utils";
import { initialsFrom } from "./initials";

export type AvatarTileProps = {
  initial: string;
  displayName: string | null;
  email: string;
  signOut: () => Promise<void>;
};

/**
 * `AccountMenu` renders `<div.relative> <button/> <div role=menu/> </div>` with rail-era
 * styling (round `--nav-*` chip, menu flying out to the right). These arbitrary-variant
 * selectors reach through the wrapper to restyle that DOM in place — a 40px Today tile and
 * a menu that opens below-right — without touching the component. Each rule targets the
 * element by structure (`> div > button`, `> div > div`, `[role=menuitem]`), so its
 * specificity beats the component's own single-class utilities.
 */
const ACCOUNT_MENU_RESTYLE = [
  // trigger → 40px surface tile, mono initials
  "[&>div>button]:size-10 [&>div>button]:rounded-[var(--r-tile)] [&>div>button]:bg-[var(--surface)]",
  "[&>div>button]:font-mono [&>div>button]:text-xs [&>div>button]:font-semibold [&>div>button]:text-[var(--ink)]",
  "[&>div>button]:ring-1 [&>div>button]:ring-[var(--line)] [&>div>button]:shadow-[var(--shadow-tile)]",
  "[&>div>button]:transition-[color,background-color,box-shadow] [&>div>button]:duration-120 [&>div>button]:ease-out",
  "[&>div>button:hover]:bg-[var(--surface)] [&>div>button:hover]:ring-[var(--line-strong)]",
  "[&>div>button:focus-visible]:outline-none [&>div>button:focus-visible]:ring-1 [&>div>button:focus-visible]:ring-[var(--line)] [&>div>button:focus-visible]:shadow-[var(--focus-ring)]",
  // menu → below-right, Today panel tokens
  "[&>div>div]:bottom-auto [&>div>div]:left-auto [&>div>div]:right-0 [&>div>div]:top-full [&>div>div]:ml-0 [&>div>div]:mt-2",
  "[&>div>div]:w-60 [&>div>div]:rounded-[var(--r-square)] [&>div>div]:border-[var(--line)] [&>div>div]:bg-[var(--surface)]",
  "[&>div>div]:text-[var(--ink)] [&>div>div]:shadow-[var(--shadow-card)]",
  // menu rows → --r-btn corners, --surface-2 hover, visible focus
  "[&_[role=menuitem]]:rounded-[var(--r-btn)] [&_[role=menuitem]:hover]:bg-[var(--surface-2)]",
  "[&_[role=menuitem]:focus-visible]:outline-none [&_[role=menuitem]:focus-visible]:shadow-[var(--focus-ring)]",
].join(" ");

/** 40×40 tile showing the person's initials; opens the existing account menu below-right. */
export function AvatarTile({ initial, displayName, email, signOut, className }: AvatarTileProps & { className?: string }) {
  return (
    <div className={cn("relative shrink-0", ACCOUNT_MENU_RESTYLE, className)}>
      <AccountMenu
        initial={initialsFrom(displayName, initial)}
        displayName={displayName}
        email={email}
        signOut={signOut}
      />
    </div>
  );
}
