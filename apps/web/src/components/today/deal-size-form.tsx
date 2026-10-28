"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useId } from "react";
import { toast } from "sonner";

import { setDealValue } from "@/app/(app)/today/actions";
import type { ActionTileSpec } from "@/lib/today/tiles";
import { cn } from "@/lib/utils";

import { FOCUS_RING } from "./buttons";
import { Glyph } from "./glyphs";
import { toneClasses } from "./tile-tone";

type SaveState = { ok: true } | { ok: false; message: string } | null;

/**
 * The deal-size ask's inline body (a P3 tile, admins only): `$` + whole-dollar input + Save.
 * A save unlocks pipeline dollars on the Results overview; the tile leaves on the refresh. The action's message
 * (bad amount, not an admin) replaces the meta line.
 */
export function DealSizeForm({ tile, className }: { tile: ActionTileSpec; className?: string }) {
  const router = useRouter();
  const inputId = useId();
  const [state, formAction, pending] = useActionState<SaveState, FormData>((_prev, fd) => setDealValue(fd), null);

  useEffect(() => {
    if (state?.ok) {
      toast("Deal size saved. Your pipeline now shows dollars.", {
        action: { label: "Open Results", onClick: () => router.push(tile.href) },
      });
      router.refresh();
    }
  }, [state, router, tile.href]);

  const error = state && !state.ok ? state.message : null;

  return (
    <form
      action={formAction}
      className={cn(
        "grid h-[76px] w-full grid-cols-[40px_1fr] items-center rounded-[var(--r-card)] bg-[var(--surface)] px-4 shadow-[var(--shadow-card)] ring-1 ring-[var(--line)] max-md:h-[80px]",
        className,
      )}
    >
      <span className={cn("flex size-10 items-center justify-center rounded-[var(--r-tile)]", toneClasses(tile.tone))}>
        <Glyph name={tile.glyph} size={18} />
      </span>
      <span className="min-w-0 pl-4 pr-7">
        <label htmlFor={inputId} className="block truncate text-sm font-semibold leading-5 text-[var(--ink)]">
          {tile.title}
        </label>
        <span className="mt-1 flex items-center gap-2">
          <span className="relative min-w-0 flex-1">
            <span aria-hidden="true" className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 font-mono text-[13px] text-[var(--ink-dim)]">
              $
            </span>
            <input
              id={inputId}
              name="dealValue"
              inputMode="numeric"
              autoComplete="off"
              placeholder="2,500"
              aria-invalid={error ? true : undefined}
              aria-describedby={`${inputId}-hint`}
              title="Whole dollars"
              className={cn(
                "h-7 w-full rounded-[var(--r-btn)] bg-[var(--surface-2)] pl-5 pr-2 font-mono text-[13px] text-[var(--ink)] ring-1 ring-[var(--line)] placeholder:text-[var(--ink-dim)]",
                FOCUS_RING,
              )}
            />
          </span>
          <button
            type="submit"
            disabled={pending}
            className={cn(
              "h-7 shrink-0 rounded-[var(--r-btn)] bg-[var(--ink)] px-3 text-[13px] font-semibold text-[var(--surface)] disabled:opacity-60",
              FOCUS_RING,
            )}
          >
            {pending ? "Saving…" : "Save"}
          </button>
        </span>
        <span id={`${inputId}-hint`} role={error ? "alert" : undefined} className={cn("block truncate text-[12px] leading-4", error ? "text-[var(--danger)]" : "text-[var(--ink-dim)]")}>
          {error ?? `${tile.meta} · whole dollars`}
        </span>
      </span>
    </form>
  );
}
