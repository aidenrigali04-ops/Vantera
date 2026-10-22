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
  "grid h-[76px] w-full grid-cols-[40px_1fr_32px] items-center rounded-[var(--r-card)] bg-[var(--surface)] px-4 text-left shadow-[var(--shadow-card)] ring-1 ring-[var(--line)] max-md:h-[80px]",
  "transition-[box-shadow,background-color] duration-120 ease-out group-hover:ring-[var(--line-strong)] group-hover:shadow-[var(--shadow-lift)]",
  FOCUS_RING,
);

export function ActionTile({ tile, onDismiss, onResume, className }: ActionTileProps) {
  const body = (
    <>
      <span className={cn("flex size-10 items-center justify-center rounded-[var(--r-tile)]", toneClasses(tile.tone))}>
        <Glyph name={tile.glyph} size={18} />
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
          "flex size-8 items-center justify-center rounded-[var(--r-btn)] text-[var(--ink-dim)]",
          "transition-[color,transform] duration-120 ease-out group-hover:translate-x-0.5 group-hover:text-[var(--acc)]",
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
      <h2 id="today-needs-you" className="mb-3 text-[13px] font-semibold leading-4 text-[var(--ink)]">
        Needs you (<span className="font-mono">{tiles.length}</span>)
      </h2>
      {tiles.length === 0 ? (
        emptyText != null ? (
          <EmptyLine>{typeof emptyText === "string" ? <MonoText text={emptyText} /> : emptyText}</EmptyLine>
        ) : null
      ) : (
        <ul className="grid gap-3 md:grid-cols-12 md:gap-x-4">
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
