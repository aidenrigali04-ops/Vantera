/**
 * Which draft the Approvals pane shows (pure). `?draft=` wins when it is still in the queue;
 * when it was just removed (approved / rejected / declined) the next remaining row opens —
 * or the previous one at the end of the list; otherwise the first remaining row auto-opens.
 */
export function resolveOpenDraft(
  ids: readonly string[],
  draftParam: string | null | undefined,
  removed: ReadonlySet<string> = new Set()
): string | null {
  const visible = (id: string) => !removed.has(id);
  if (draftParam) {
    const at = ids.indexOf(draftParam);
    if (at >= 0) {
      if (visible(draftParam)) return draftParam;
      const after = ids.slice(at + 1).find(visible);
      if (after) return after;
      const before = ids.slice(0, at).reverse().find(visible);
      return before ?? null;
    }
  }
  return ids.find(visible) ?? null;
}

/**
 * Resync the optimistic "removed" set with revalidated server rows: an id the server no
 * longer returns has really left the queue (drop it — so an Undo that brings it back shows
 * it again); an id still present stays hidden until the server catches up.
 */
export function reconcileRemoved(removed: ReadonlySet<string>, rowIds: readonly string[]): Set<string> {
  const present = new Set(rowIds);
  return new Set([...removed].filter((id) => present.has(id)));
}

/** A stable key for the SET of row ids on screen — a re-render with the same rows keeps it. */
export function rowsKey(rows: readonly { id: string }[]): string {
  return rows.map((r) => r.id).join("\u0000");
}
