"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { CHROME_TILE } from "./tile";

type UtilityTileBase = {
  /** Accessible name (aria-label). */
  label: string;
  /** Native tooltip; defaults to `label`. */
  title?: string;
  icon: LucideIcon;
  className?: string;
};

export type UtilityTileProps = UtilityTileBase &
  ({ href: string; onClick?: never } | { href?: never; onClick: () => void });

/** 40×40 icon tile: an 18px --ink-mid glyph that darkens to --ink on hover; link or button. */
export function UtilityTile({ label, title, icon: Icon, className, href, onClick }: UtilityTileProps) {
  const classes = cn(CHROME_TILE, "text-[var(--ink-mid)] hover:text-[var(--ink)]", className);
  const glyph = <Icon className="size-4.5" strokeWidth={1.75} aria-hidden="true" />;
  if (href) {
    return (
      <Link href={href} aria-label={label} title={title ?? label} className={classes}>
        {glyph}
      </Link>
    );
  }
  return (
    <button type="button" aria-label={label} title={title ?? label} onClick={onClick} className={classes}>
      {glyph}
    </button>
  );
}
