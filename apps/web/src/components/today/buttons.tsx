import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import { Glyph, type GlyphName } from "./glyphs";

/**
 * Today buttons (blueprint §6.4). One filled button per page (InkButton — ink, never
 * accent), a hairline GhostButton for secondary actions, and a TextLink for inline links.
 * No directive: each renders as a server or client component depending on the importer;
 * the `onClick` forms are for client callers, `action` takes a server action.
 */

export const FOCUS_RING = "focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]";
const HOVER_TRANSITION = "transition-[background-color,color,box-shadow,transform] duration-120 ease-out";

type LinkTarget = { href: string; onClick?: never; action?: never; disabled?: never };
type ClickTarget = { onClick?: () => void; href?: never; action?: never; disabled?: boolean };
type ActionTarget = { action: (formData: FormData) => void | Promise<void>; href?: never; onClick?: never; disabled?: boolean };

interface ButtonBase {
  children: ReactNode;
  /** 16px lucide glyph on the left */
  glyph?: GlyphName;
  className?: string;
  "aria-label"?: string;
}

export type InkButtonProps = ButtonBase & { count?: number | null } & (LinkTarget | ClickTarget | ActionTarget);

const INK =
  "inline-flex h-10 items-center justify-center gap-3 whitespace-nowrap rounded-[var(--r-btn)] bg-[var(--ink)] px-4 text-sm font-medium text-[var(--ink-fg)] hover:bg-[#1f1f23] active:translate-y-[0.5px] disabled:pointer-events-none disabled:opacity-60";

export function InkButton({ children, glyph, count, className, "aria-label": ariaLabel, ...target }: InkButtonProps) {
  const classes = cn(INK, HOVER_TRANSITION, FOCUS_RING, className);
  const body = (
    <>
      {glyph ? <Glyph name={glyph} size={16} className="shrink-0" /> : null}
      <span className="truncate">{children}</span>
      {count != null ? (
        <span className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-[var(--r-pill)] bg-[rgb(255_255_255_/_0.16)] px-1.5 font-mono text-xs font-medium leading-none">
          {count}
        </span>
      ) : null}
    </>
  );
  if (target.href) {
    return (
      <Link href={target.href} className={classes} aria-label={ariaLabel}>
        {body}
      </Link>
    );
  }
  if (target.action) {
    return (
      <form action={target.action} className="contents">
        <button type="submit" className={classes} disabled={target.disabled} aria-label={ariaLabel}>
          {body}
        </button>
      </form>
    );
  }
  return (
    <button type="button" onClick={target.onClick} className={classes} disabled={target.disabled} aria-label={ariaLabel}>
      {body}
    </button>
  );
}

export type GhostButtonProps = ButtonBase & (LinkTarget | ClickTarget);

const GHOST =
  "inline-flex h-9 items-center justify-center gap-2 whitespace-nowrap rounded-[var(--r-btn)] bg-transparent px-3 text-sm font-medium text-[var(--ink)] ring-1 ring-[var(--line)] hover:bg-[var(--surface-2)] disabled:pointer-events-none disabled:opacity-60";

export function GhostButton({ children, glyph, className, "aria-label": ariaLabel, ...target }: GhostButtonProps) {
  const classes = cn(GHOST, HOVER_TRANSITION, FOCUS_RING, className);
  const body = (
    <>
      {glyph ? <Glyph name={glyph} size={16} className="shrink-0" /> : null}
      <span className="truncate">{children}</span>
    </>
  );
  if (target.href) {
    return (
      <Link href={target.href} className={classes} aria-label={ariaLabel}>
        {body}
      </Link>
    );
  }
  return (
    <button type="button" onClick={target.onClick} className={classes} disabled={target.disabled} aria-label={ariaLabel}>
      {body}
    </button>
  );
}

export interface TextLinkProps {
  href: string;
  children: ReactNode;
  className?: string;
}

/** 14px/500 accent link; the underline appears on hover only. */
export function TextLink({ href, children, className }: TextLinkProps) {
  return (
    <Link
      href={href}
      className={cn(
        "rounded-[2px] text-sm font-medium text-[var(--acc)] underline-offset-[3px] hover:underline",
        FOCUS_RING,
        className,
      )}
    >
      {children}
    </Link>
  );
}
