/** Shared types for the DraftPeek pieces (composition root: `../draft-peek.tsx`). */

/** how a draft left the queue — the caller collapses its row */
export type Outcome = "approved" | "rejected" | "suppressed";

/** text the server returned for a draft (save / fix / regenerate) */
export type DraftText = { body: string; styleFlags: string | null };

/** the one call in flight for a draft, keyed by send id */
export type Inflight = "approve" | "reject" | "suppress" | "save" | "regenerate" | "fix";

export type PeekMode = "read" | "edit" | "reject";

/** a thrown action (network drop) reads as an error result, so in-flight state always clears */
export const failed = (): { error: string } => ({ error: "Something went wrong. Try again." });
