/**
 * How the app shell lays out a route. Today scrolls the window (it is a launchpad); the data
 * surfaces stay one viewport tall with their own inner scroller (rule 07); everything else
 * (settings, wizards) scrolls naturally.
 *
 * Pure so the shell can compute it on the client from `usePathname()`: the (app) layout is not
 * re-rendered on in-app navigation, so a server-side answer goes stale after the first click.
 */
export function shellRoute(pathname: string | null): { onToday: boolean; oneScreen: boolean } {
  const path = (pathname ?? "").split("?")[0] ?? "";
  const onToday = path.startsWith("/today");
  const oneScreen =
    path === "/approvals" ||
    path === "/inbox" ||
    path === "/prospects" ||
    path.startsWith("/prospects/") ||
    path === "/playbook" ||
    path === "/dashboard" ||
    path === "/sequence";
  return { onToday, oneScreen };
}
