import type { ActionTileSpec } from "./tiles";

/**
 * P3 ask: once the account has a reply but no average deal size, ask an admin for it
 * inline — saving it unlocks the pipeline dollars on the Results overview. Members can't
 * set it, so they never see the ask. Dismissible for the day like any ask.
 */
export function dealSizeTile(
  avgDealValueCents: number | null,
  repliesTotal: number,
  isAdmin: boolean,
): ActionTileSpec | null {
  if (!isAdmin || avgDealValueCents != null || repliesTotal < 1) return null;
  return {
    kind: "deal_size",
    priority: 3,
    tone: "routine",
    glyph: "dollar-sign",
    title: "Set your average deal size",
    meta: "to see pipeline in dollars",
    href: "/dashboard",
    dismissible: true,
    inline: "deal_size",
  };
}
