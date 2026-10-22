"use client";

import Link from "next/link";
import { VanteraLogo } from "@/components/landing/vantera-logo";
import { cn } from "@/lib/utils";
import { CHROME_TILE } from "./tile";

/** 40×40 surface tile carrying the 18px brand mark in --ink; links home (/today). */
export function LogoTile({ className }: { className?: string }) {
  return (
    <Link href="/today" aria-label="Vantera home" className={cn(CHROME_TILE, "bg-[var(--acc)] text-white ring-0 hover:bg-[var(--acc-ink)] hover:text-white", className)}>
      <VanteraLogo className="size-[18px]" />
    </Link>
  );
}
