/** Prev/next over the table's final row order — pure, so the peek's navigation is unit-tested. */
export function peekNav(
  ids: string[],
  openId: string | null
): { index: number; total: number; prevId: string | null; nextId: string | null } {
  const index = openId == null ? -1 : ids.indexOf(openId);
  if (index < 0) return { index: -1, total: ids.length, prevId: null, nextId: null };
  return {
    index,
    total: ids.length,
    prevId: index > 0 ? ids[index - 1] : null,
    nextId: index < ids.length - 1 ? ids[index + 1] : null,
  };
}
