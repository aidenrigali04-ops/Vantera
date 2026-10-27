import type { ActionTileSpec } from "./tiles";

/**
 * P3 ask: once the account has a reply but no average deal size, ask for it inline —
 * saving it unlocks the dollar figures on Results. Dismissible for the day like any ask.
 */
export function dealSizeTile(avgDealValueCents: number | null, repliesTotal: number): ActionTileSpec | null {
  if (avgDealValueCents != null || repliesTotal < 1) return null;
  return {
    kind: "deal_size",
    priority: 3,
    tone: "routine",
    glyph: "dollar-sign",
    title: "Set your average deal size",
    meta: "to see pipeline in dollars",
    href: "/dashboard?view=analytics",
    dismissible: true,
    inline: "deal_size",
  };
}
