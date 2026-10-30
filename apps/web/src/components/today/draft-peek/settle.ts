import { applyIfCurrent, type AfterRemoval } from "../peek-result";

/**
 * After an approve / reject / suppress call returns. The server-side change happened whatever
 * the owner is looking at now, so on success the row always collapses and the toast always
 * shows; only the error message and the navigation are guarded by "is `id` still open"
 * (`applyIfCurrent`). Pure: the caller passes the live open id. Returns true on success.
 */
export function settleRemoval(
  id: string,
  res: { error?: string },
  step: AfterRemoval | null,
  ctx: {
    currentId: string | null;
    onError: (message: string) => void;
    onRemoved: () => void;
    announce: () => void;
    onNavigate: (id: string) => void;
    onClose: () => void;
  }
): boolean {
  const live = applyIfCurrent(ctx.currentId, { sendId: id }) !== null;
  if (res.error) {
    if (live) ctx.onError(res.error);
    return false;
  }
  ctx.onRemoved();
  ctx.announce();
  if (step && live) {
    if (step.kind === "open") ctx.onNavigate(step.id);
    else ctx.onClose();
  }
  return true;
}
