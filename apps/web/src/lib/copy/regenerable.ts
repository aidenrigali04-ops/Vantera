/**
 * A queued draft can be regenerated only when the first-touch brain wrote it (the invite and
 * its first message). Follow-ups are drafted from the running thread and reply responses from
 * the conversation — regenerating those through the first-touch brain would replace a
 * thread-aware message with a cold intro. Hand-written drafts carry no recipe. Pure.
 */
export function isRegenerable(recipe: unknown): boolean {
  return (recipe as { brain?: unknown } | null | undefined)?.brain === "first_touch";
}

/** Why Regenerate is off for this draft (the disabled control's tooltip), or null when it's on. */
export function regenerateOffReason(row: { regenerable: boolean; origin: string | null }): string | null {
  if (row.regenerable) return null;
  if (row.origin === "reply_response") return "Replies are written from the conversation — edit this one instead.";
  if (row.origin === "manual") return "Hand-written drafts can't be regenerated — edit this one instead.";
  return "Follow-ups are written from the thread so far — edit this one instead.";
}
