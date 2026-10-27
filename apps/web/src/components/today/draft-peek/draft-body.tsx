"use client";

import { Check, ExternalLink, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { QueueRow } from "@/lib/today/rows";
import { DraftPreview } from "../draft-preview";
import type { StyleFlag } from "../style-flags";
import type { Inflight, PeekMode } from "./types";

/** "Why now" — the evidence bullets (signals + the rank's pain points / triggers). */
export function Evidence({ items }: { items: QueueRow["evidence"] }) {
  if (items.length === 0) return null;
  return (
    <section className="mb-5">
      <p className="mb-2 text-[12px] font-medium text-[var(--ink-dim)]">Why now</p>
      <ul className="flex flex-col gap-1.5">
        {items.map((e, i) => (
          <li key={i} className="flex items-start gap-2 text-[14px] leading-snug text-[var(--ink)]">
            <span className="mt-[7px] size-1.5 shrink-0 rounded-full bg-[var(--ink-dim)]" aria-hidden />
            <span className="min-w-0">
              {e.text}
              {e.href && (
                <a href={e.href} target="_blank" rel="noreferrer" className="ml-1.5 inline-flex items-center gap-0.5 align-middle text-[12px] font-medium text-[var(--acc)] hover:underline">
                  source <ExternalLink className="size-3" strokeWidth={1.75} />
                </a>
              )}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * The draft itself: a skeleton while it's being rewritten, the editor in edit mode, otherwise
 * the LinkedIn preview — then its style flags.
 */
export function DraftBody({
  row,
  body,
  styleFlags,
  mode,
  doing,
  editBody,
  onEditBody,
  onSave,
  onCancelEdit,
}: {
  row: QueueRow;
  body: string;
  styleFlags: StyleFlag[];
  mode: PeekMode;
  doing: Inflight | undefined;
  editBody: string;
  onEditBody: (b: string) => void;
  onSave: () => void;
  onCancelEdit: () => void;
}) {
  const busy = doing === "regenerate" || doing === "fix";
  const editOver = editBody.length > row.charLimit;
  return (
    <>
      {busy ? (
        <div role="status" aria-busy="true" aria-label={doing === "fix" ? "Fixing the draft" : "Rewriting the draft"} className="flex flex-col gap-2.5 rounded-[var(--r-square)] bg-[var(--surface-2)] p-4">
          {["w-full", "w-11/12", "w-4/5", "w-2/3"].map((w) => (
            <span key={w} className={cn("h-3 rounded-full bg-[var(--line)] motion-safe:animate-pulse", w)} />
          ))}
        </div>
      ) : mode === "edit" ? (
        <div className="flex flex-col gap-3">
          <textarea
            value={editBody}
            onChange={(e) => onEditBody(e.target.value)}
            rows={7}
            autoFocus
            aria-label="Edit the draft"
            className="w-full resize-y rounded-[var(--r-square)] border border-[var(--line-strong)] bg-[var(--surface)] p-4 text-[14px] leading-[1.55] text-[var(--ink)] outline-none focus:shadow-[var(--focus-ring)]"
          />
          <div className="flex items-center gap-2">
            <button type="button" onClick={onSave} disabled={doing !== undefined || editOver || !editBody.trim()} className="inline-flex h-9 items-center gap-2 rounded-[var(--r-btn)] bg-[var(--acc)] px-4 text-[14px] font-semibold text-white disabled:opacity-40">
              {doing === "save" ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" strokeWidth={1.75} />} Save
            </button>
            <button type="button" onClick={onCancelEdit} className="inline-flex h-9 items-center rounded-[var(--r-btn)] px-3 text-[14px] font-medium text-[var(--ink-mid)] ring-1 ring-[var(--line)] hover:bg-[var(--surface-2)]">
              Cancel
            </button>
            <span className={cn("ml-auto font-mono text-[12px]", editOver ? "text-[var(--danger)]" : "text-[var(--ink-dim)]")}>
              {editBody.length}/{row.charLimit}
            </span>
          </div>
        </div>
      ) : (
        <DraftPreview body={body} stage={row.step} charLimit={row.charLimit} />
      )}
      {styleFlags.length > 0 && !busy && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {styleFlags.map((f) => (
            <span
              key={f.label + (f.detail ?? "")}
              title={f.detail ?? undefined}
              className="inline-flex h-6 items-center rounded-[var(--r-chip)] bg-[var(--attention-tint)] px-2 text-[11px] font-medium text-[var(--attention)]"
            >
              {f.label}
            </span>
          ))}
        </div>
      )}
    </>
  );
}
