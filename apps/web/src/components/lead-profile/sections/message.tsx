"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { saveDraftEdit, type ReviewActionState } from "@/app/(app)/approvals/actions";
import type { QueuedDraft, RegenerateDraft } from "../types";

const DRAFT_STATUS: Record<string, string> = {
  pending_review: "Waiting for your approval",
  approved: "Approved",
  scheduled: "Scheduled to send",
};
const STAGE_LABEL: Record<string, string> = {
  invite: "Connection note",
  message: "Message",
};

function flagsText(flags: unknown): string | null {
  if (typeof flags === "string") return flags.trim() || null;
  if (Array.isArray(flags) && flags.length > 0) return flags.map(String).join(" · ");
  return null;
}

/** The prospect's queued draft, editable while it waits in review. Regenerate shows only when the
 *  caller supplies `onRegenerate` (the steerable regenerate action ships separately). */
export function MessageSection({
  draft,
  onRegenerate,
  initialEditing = false,
  initialError,
}: {
  draft: QueuedDraft;
  onRegenerate?: RegenerateDraft;
  /** test/preview seams: start in the editor, optionally with a save error showing */
  initialEditing?: boolean;
  initialError?: string;
}) {
  const [body, setBody] = useState(draft.body);
  const [flags, setFlags] = useState<string | null>(flagsText(draft.style_flags));
  const [editing, setEditing] = useState(initialEditing);
  const [steer, setSteer] = useState("");
  const [regenError, setRegenError] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const editable = draft.status === "pending_review";

  const router = useRouter();
  // Only what the server confirms it wrote reaches the screen: the returned body + re-linted flags.
  // An error (draft no longer pending, or not allowed) keeps the editor open with the message.
  const [state, action, pending] = useActionState<ReviewActionState, FormData>(async (prev, fd) => {
    const res = await saveDraftEdit(prev, fd);
    if (!res.error) {
      setBody(res.body ?? String(fd.get("body") ?? "").trim());
      setFlags(res.styleFlags ?? null);
      setEditing(false);
      router.refresh(); // the table row and any remount read the saved draft
    }
    return res;
  }, initialError ? { error: initialError } : {});

  const regenerate = async () => {
    if (!onRegenerate) return;
    setRegenerating(true);
    setRegenError(null);
    try {
      const res = await onRegenerate(draft.id, steer.trim());
      if (res.error) setRegenError(res.error);
      else {
        if (res.body != null) setBody(res.body);
        if (res.styleFlags !== undefined) setFlags(res.styleFlags);
        setSteer("");
      }
    } finally {
      setRegenerating(false);
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        {[draft.linkedin_stage ? (STAGE_LABEL[draft.linkedin_stage] ?? draft.linkedin_stage) : null, DRAFT_STATUS[draft.status] ?? draft.status]
          .filter(Boolean)
          .join(" · ")}
      </p>
      {editing ? (
        <form action={action} className="space-y-2">
          <input type="hidden" name="sendId" value={draft.id} />
          <input type="hidden" name="channel" value="linkedin" />
          <textarea
            name="body"
            defaultValue={body}
            rows={6}
            aria-label="Edit message"
            className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] p-3 text-sm focus-visible:border-[var(--cyan-line)] focus-visible:outline-none"
          />
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={pending}
              className="rounded-[var(--r-btn)] bg-foreground px-3 py-1.5 text-xs font-semibold text-background disabled:opacity-50"
            >
              {pending ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
            >
              Cancel
            </button>
          </div>
          {state.error && (
            <p role="alert" className="text-xs text-destructive">
              {state.error}
            </p>
          )}
        </form>
      ) : (
        <p className="whitespace-pre-wrap rounded-lg bg-[var(--surface-2)] p-3 text-sm text-[var(--ink)]">{body}</p>
      )}
      {flags && (
        <p className="rounded-lg bg-[var(--attention-tint)] px-3 py-2 text-xs text-[var(--attention)]">
          Style check: {flags}
        </p>
      )}
      {editable && !editing && (
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-1.5 text-xs font-medium transition-colors hover:bg-[var(--surface-2)]"
          >
            Edit
          </button>
          {onRegenerate && (
            <div className="space-y-2">
              <textarea
                value={steer}
                onChange={(e) => setSteer(e.target.value)}
                rows={2}
                maxLength={300}
                placeholder="Steer the rewrite (optional) — e.g. shorter, mention their hiring post"
                aria-label="Steer the rewrite"
                className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] p-2.5 text-sm placeholder:text-muted-foreground/60 focus-visible:border-[var(--cyan-line)] focus-visible:outline-none"
              />
              <button
                type="button"
                onClick={regenerate}
                disabled={regenerating}
                className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-1.5 text-xs font-medium transition-colors hover:bg-[var(--surface-2)] disabled:opacity-50"
              >
                {regenerating ? "Regenerating…" : "Regenerate"}
              </button>
              {regenError && <p className="text-xs text-destructive">{regenError}</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
