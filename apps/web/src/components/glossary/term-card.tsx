"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Bookmark, Check, Clock, Link2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { CARD_INTERACTIVE } from "@/components/landing/surface";
import type { GlossaryTerm } from "@/lib/glossary";
import { categoryLabel } from "@/lib/glossary";
import { CategoryBadge, CategoryIcon, DifficultyBadge, Highlight, useBookmarks } from "./glossary-ui";

/**
 * Premium glossary card — category + difficulty + reading time + popularity + updated, with
 * bookmark and copy-link actions revealed on hover. The whole card is clickable via a
 * stretched link (the title's `after:absolute inset-0`), while the action buttons sit above
 * it (`relative z-10`) so there's no invalid nested-interactive markup.
 */
export function TermCard({ term, query = "" }: { term: GlossaryTerm; query?: string }) {
  const { isBookmarked, toggle } = useBookmarks();
  const [copied, setCopied] = useState(false);
  const bookmarked = isBookmarked(term.slug);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/glossary/${term.slug}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard blocked — no-op */
    }
  }

  return (
    <article className={cn(CARD_INTERACTIVE, "group relative flex h-full flex-col p-5")}>
      {/* top row — category + actions */}
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5">
          <span className="grid size-6 place-items-center rounded-md bg-[var(--cyan-tint)] text-[var(--cyan-strong)] ring-1 ring-inset ring-[var(--cyan-line)]">
            <CategoryIcon category={term.category} className="size-3.5" />
          </span>
          <CategoryBadge label={categoryLabel(term.category)} />
        </span>

        <span className="relative z-10 flex items-center gap-0.5">
          <button
            type="button"
            onClick={copyLink}
            aria-label={`Copy link to ${term.term}`}
            className="grid size-7 place-items-center rounded-lg text-[var(--ink-4)] opacity-0 transition-all hover:bg-[var(--tint)] hover:text-[var(--ink-2)] focus-visible:opacity-100 group-hover:opacity-100"
          >
            {copied ? <Check className="size-4 text-[#1a9e4b]" strokeWidth={2.6} /> : <Link2 className="size-4" />}
          </button>
          <button
            type="button"
            onClick={() => toggle(term.slug)}
            aria-label={bookmarked ? `Remove ${term.term} bookmark` : `Bookmark ${term.term}`}
            aria-pressed={bookmarked}
            className={cn(
              "grid size-7 place-items-center rounded-lg transition-all hover:bg-[var(--tint)] focus-visible:opacity-100",
              bookmarked
                ? "text-[var(--cyan-strong)] opacity-100"
                : "text-[var(--ink-4)] opacity-0 hover:text-[var(--ink-2)] group-hover:opacity-100",
            )}
          >
            <Bookmark className={cn("size-4", bookmarked && "fill-current")} />
          </button>
        </span>
      </div>

      {/* title — the stretched link */}
      <h3 className="mt-4 text-[16.5px] font-semibold leading-snug tracking-[-0.015em] text-foreground">
        <Link href={`/glossary/${term.slug}`} className="after:absolute after:inset-0 after:content-['']">
          <Highlight text={term.term} query={query} />
        </Link>
      </h3>
      <p className="mt-1.5 line-clamp-2 flex-1 text-[13.5px] leading-relaxed text-[var(--ink-3)]">
        <Highlight text={term.summary} query={query} />
      </p>

      {/* meta row */}
      <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-[var(--hairline)] pt-3.5">
        <DifficultyBadge difficulty={term.difficulty} />
        <span className="inline-flex items-center gap-1 text-[11.5px] text-[var(--ink-4)]">
          <Clock className="size-3" strokeWidth={2.2} />
          {term.readingTime} min
        </span>
        <span className="inline-flex items-center gap-1.5 text-[11.5px] text-[var(--ink-4)]">
          <span className="relative h-1 w-8 overflow-hidden rounded-full bg-[#e6eaef]" aria-hidden>
            <span
              className="absolute inset-y-0 left-0 rounded-full bg-[var(--fb)]"
              style={{ width: `${term.popularity}%` }}
            />
          </span>
          {term.popularity}
        </span>
        <span className="ml-auto inline-flex items-center gap-1 text-[11.5px] font-medium text-[var(--cyan-strong)]">
          Read
          <ArrowUpRight className="size-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </span>
      </div>
    </article>
  );
}
