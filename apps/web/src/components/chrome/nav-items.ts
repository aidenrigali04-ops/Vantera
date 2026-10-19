/**
 * Primary destinations, shared by the desktop NavPill. Learning is the machine-learning
 * page: the only place a subject is created. Mobile keeps Today, Approvals, and Inbox in
 * the tab bar; Learning is in the command palette with the other destinations.
 */
export type NavKey = "today" | "approvals" | "inbox" | "prospects" | "playbook" | "learning";

export type NavItem = { key: NavKey; label: string; href: string };

export const NAV_ITEMS: readonly NavItem[] = [
  { key: "today", label: "Today", href: "/today" },
  { key: "approvals", label: "Approvals", href: "/approvals" },
  { key: "inbox", label: "Inbox", href: "/inbox" },
  { key: "prospects", label: "Prospects", href: "/prospects" },
  { key: "playbook", label: "Playbook", href: "/playbook" },
  { key: "learning", label: "Learning", href: "/learning" },
];

/** Only Approvals and Inbox carry counts — the two queues a person works down. */
export type NavBadges = { approvals?: number; inbox?: number };

/** A tab is active on its own route and every route beneath it (`/inbox/123`), never on a
 *  sibling that merely shares the prefix (`/inboxes`). */
export function isActivePath(pathname: string | null | undefined, href: string): boolean {
  if (!pathname) return false;
  return pathname === href || pathname.startsWith(href + "/");
}

/** Badge text: hidden (null) at zero or below, capped at "99+". */
export function formatBadge(count: number | null | undefined): string | null {
  if (count == null || !Number.isFinite(count) || count <= 0) return null;
  return count > 99 ? "99+" : String(Math.floor(count));
}

export function badgeFor(badges: NavBadges | undefined, key: NavKey): number | undefined {
  if (!badges) return undefined;
  if (key === "approvals") return badges.approvals;
  if (key === "inbox") return badges.inbox;
  return undefined;
}
