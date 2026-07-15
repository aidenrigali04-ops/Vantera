"use client";

import { useRef, useState } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { addLeadNote, deleteLeadNote } from "./edit-actions";

export type LeadNote = {
  id: string;
  body: string;
  author_user_id: string | null;
  created_at: string;
};

const dateFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });

/**
 * R6: the user's own knowledge about a prospect, kept on the brief. Newest first;
 * a note is removed by its author (the × only shows on your own notes; RLS enforces).
 */
export function LeadNotes({
  leadId,
  currentUserId,
  notes,
}: {
  leadId: string;
  currentUserId: string;
  notes: LeadNote[];
}) {
  const [busy, setBusy] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const submit = (fd: FormData) => {
    setBusy(true);
    addLeadNote(fd)
      .then((res) => {
        if (res.error) {
          toast.error(res.error);
          return;
        }
        formRef.current?.reset();
      })
      .finally(() => setBusy(false));
  };

  const remove = (noteId: string) => {
    const fd = new FormData();
    fd.set("noteId", noteId);
    fd.set("leadId", leadId);
    deleteLeadNote(fd).then((res) => {
      if (res.error) toast.error(res.error);
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <form ref={formRef} action={submit} className="flex flex-col gap-2">
        <input type="hidden" name="leadId" value={leadId} />
        <Textarea
          name="body"
          rows={2}
          maxLength={4000}
          required
          placeholder="Add a note — context only you know…"
          className="text-sm"
        />
        <Button type="submit" size="sm" variant="outline" className="self-end" disabled={busy}>
          {busy ? "Saving…" : "Add note"}
        </Button>
      </form>

      {notes.length > 0 && (
        <ul className="flex flex-col gap-2.5">
          {notes.map((n) => (
            <li key={n.id} className="rounded-xl bg-[var(--tint)] px-3.5 py-2.5">
              <div className="flex items-start justify-between gap-2">
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--ink-2)]">{n.body}</p>
                {n.author_user_id === currentUserId && (
                  <ConfirmDialog
                    title="Remove this note?"
                    description="The note is deleted for the whole workspace. This can't be undone."
                    confirmLabel="Remove note"
                    destructive
                    onConfirm={() => remove(n.id)}
                    trigger={(open) => (
                      <button
                        type="button"
                        onClick={open}
                        aria-label="Remove note"
                        className="rounded-md p-0.5 text-muted-foreground transition-colors hover:text-foreground"
                      >
                        <X className="size-3.5" />
                      </button>
                    )}
                  />
                )}
              </div>
              <p className="mt-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                {n.author_user_id === currentUserId ? "You" : "Teammate"} ·{" "}
                {dateFmt.format(new Date(n.created_at))}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
