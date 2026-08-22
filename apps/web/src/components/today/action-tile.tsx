"use client";

import Link from "next/link";
import type { MouseEvent, ReactNode } from "react";

import type { ActionTileSpec, TileKind } from "@/lib/today/tiles";
import { cn } from "@/lib/utils";

import { FOCUS_RING } from "./buttons";
import { EmptyLine } from "./empty-line";
import { Glyph } from "./glyphs";
import { MonoText } from "./mono-text";
import { toneClasses } from "./tile-tone";

/**
 * Z4 · "Needs you" action tiles (blueprint §6.6). An unboxed 64px row — tone-tinted icon
 * square · title + meta · a chrome chevron tile — that is one Link (or one button for the
 * inline engine resume). Color sits on the icon square only. The dismiss `×` of a P3/P4
 * ask is a sibling overlay, never nested inside the link (no interactive content inside
 * interactive content), and appears on hover / keyboard focus.
 */

export interface ActionTileProps {
  tile: ActionTileSpec;
  onDismiss?: (kind: TileKind) => void;
  onResume?: () => void;
  className?: string;
}

const ROW = cn(
  "grid h-16 w-full grid-cols-[48px_1fr_40px] items-center rounded-[var(--r-square)] text-left max-md:h-[72px]",
  "transition-colors duration-120 ease-out group-hover:bg-[rgb(11_11_13_/_0.025)]",
  FOCUS_RING,
);

export function ActionTile({ tile, onDismiss, onResume, className }: ActionTileProps) {
  const body = (
    <>
      <span className={cn("flex size-12 items-center justify-center rounded-[var(--r-square)]", toneClasses(tile.tone))}>
        <Glyph name={tile.glyph} size={20} />
      </span>
      <span className="min-w-0 pl-4 pr-3">
        <span className="block truncate text-sm font-semibold leading-5 text-[var(--ink)]">
          <MonoText text={tile.title} />
        </span>
        <span className={cn("block truncate text-[13px] leading-[18px] text-[var(--ink-dim)]", tile.dismissible && "pr-7")}>
          <MonoText text={tile.meta} />
        </span>
      </span>
      <span
        aria-hidden="true"
        className={cn(
          "flex size-10 items-center justify-center rounded-[var(--r-tile)] bg-[var(--surface)] text-[var(--ink-mid)] shadow-[var(--shadow-tile)] ring-1 ring-[var(--line)]",
          "transition-colors duration-120 ease-out group-hover:bg-[var(--ink)] group-hover:text-[var(--ink-fg)]",
        )}
      >
        <Glyph name="chevron-right" size={16} />
      </span>
    </>
  );

  const dismiss = (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    onDismiss?.(tile.kind);
  };

  return (
    <div className={cn("group relative", className)}>
      {tile.inline === "resume" ? (
        <button type="button" onClick={onResume} className={ROW}>
          {body}
        </button>
      ) : (
        <Link href={tile.href} className={ROW}>
          {body}
        </Link>
      )}
      {tile.dismissible ? (
        // the far right of the meta line: meta center = row center + 10px; text cell ends 52px
        // (chevron 40 + 12 gap) from the row's right edge
        <button
          type="button"
          aria-label="Dismiss"
          onClick={dismiss}
          className={cn(
            "absolute right-[52px] top-[calc(50%_+_10px)] z-10 flex size-6 -translate-y-1/2 items-center justify-center rounded-[var(--r-chip)] text-[var(--ink-dim)] opacity-0",
            "transition-[opacity,background-color,color] duration-120 ease-out hover:bg-[var(--surface-2)] hover:text-[var(--ink)] focus-visible:opacity-100 group-hover:opacity-100",
            FOCUS_RING,
          )}
        >
          <Glyph name="x" size={14} />
        </button>
      ) : null}
    </div>
  );
}

export interface ActionTileRowProps {
  tiles: ActionTileSpec[];
  onDismiss?: (kind: TileKind) => void;
  onResume?: () => void;
  /** the one calm line when nothing needs you; a string renders through MonoText */
  emptyText?: ReactNode;
  className?: string;
}

export function ActionTileRow({ tiles, onDismiss, onResume, emptyText, className }: ActionTileRowProps) {
  return (
    <section className={className} aria-labelledby="today-needs-you">
      <h2 id="today-needs-you" className="mb-4 text-xs font-medium leading-4 text-[var(--ink-dim)]">
        Needs you (<span className="font-mono">{tiles.length}</span>)
      </h2>
      {tiles.length === 0 ? (
        emptyText != null ? (
          <EmptyLine>{typeof emptyText === "string" ? <MonoText text={emptyText} /> : emptyText}</EmptyLine>
        ) : null
      ) : (
        <ul className="max-md:divide-y max-md:divide-[var(--line)] md:grid md:grid-cols-12 md:gap-x-6 md:gap-y-3">
          {tiles.map((tile) => (
            <li key={`${tile.kind}:${tile.href}`} className="md:col-span-4">
              <ActionTile tile={tile} onDismiss={onDismiss} onResume={onResume} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
