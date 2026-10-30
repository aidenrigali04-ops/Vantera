"use client";

import type { RefObject } from "react";
import { Loader2, RefreshCw } from "lucide-react";

/** Mirrors STEER_MAX_CHARS in @vantera/agent-brains (copy/steer) — local so this client file
 *  never pulls the brain package into the browser bundle. The server slices to the same cap. */
export const STEER_MAX = 280;

/** the note sent with a regenerate: trimmed and capped (the server slices to the same cap) */
export function steerNote(steer: string): string {
  return steer.trim().slice(0, STEER_MAX);
}

/**
 * Steer a rewrite: an optional note (280 cap, live counter) + the Regenerate CTA. Off for
 * drafts the first-touch brain didn't write — `offReason` is the disabled control's tooltip.
 * ⌘/Ctrl+Enter in the box regenerates.
 */
export function SteerBox({
  id,
  steer,
  onSteer,
  onRegenerate,
  offReason,
  locked,
  regenerating,
  steerRef,
}: {
  /** send id — scopes the textarea's id/label */
  id: string;
  steer: string;
  onSteer: (value: string) => void;
  onRegenerate: () => void;
  /** why Regenerate is off, or null when it's on */
  offReason: string | null;
  /** this draft has a call in flight */
  locked: boolean;
  regenerating: boolean;
  steerRef: RefObject<HTMLTextAreaElement | null>;
}) {
  const canRegenerate = offReason === null;
  return (
    <div className="mt-4" title={offReason ?? undefined}>
      <label htmlFor={`steer-${id}`} className="mb-1.5 block text-[12px] font-medium text-[var(--ink-dim)]">
        Steer a rewrite (optional)
      </label>
      <textarea
        id={`steer-${id}`}
        ref={steerRef}
        value={steer}
        onChange={(e) => onSteer(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            onRegenerate();
          }
        }}
        maxLength={STEER_MAX}
        rows={2}
        disabled={!canRegenerate}
        placeholder="Make it shorter, lead with the hiring signal…"
        className="w-full resize-none rounded-[var(--r-square)] border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-[13px] leading-[1.5] text-[var(--ink)] outline-none placeholder:text-[var(--ink-dim)] focus:shadow-[var(--focus-ring)] disabled:opacity-50"
      />
      <div className="mt-1.5 flex items-center gap-2">
        <button
          type="button"
          onClick={onRegenerate}
          disabled={!canRegenerate || locked}
          title={offReason ?? undefined}
          className="inline-flex h-8 items-center gap-1.5 rounded-[var(--r-btn)] px-3 text-[13px] font-medium text-[var(--ink)] ring-1 ring-[var(--line)] hover:bg-[var(--surface-2)] disabled:opacity-40"
        >
          {regenerating ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" strokeWidth={1.75} />}
          Regenerate <kbd className="font-mono text-[11px] text-[var(--ink-dim)]">G</kbd>
        </button>
        <span className="ml-auto font-mono text-[11px] text-[var(--ink-dim)]">
          {steer.length}/{STEER_MAX}
        </span>
      </div>
    </div>
  );
}
