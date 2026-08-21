"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowUpRight, Clock, CornerDownLeft, Search, Sparkles, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import type { GlossaryTerm } from "@/lib/glossary";
import { categoryLabel, getTrendingTerms } from "@/lib/glossary";
import { CategoryIcon, DifficultyBadge, Highlight } from "./glossary-ui";

const RECENT_KEY = "vantera:glossary:recent";
const compact = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Relevance score for a term against a query (with light typo/format tolerance). */
function scoreTerm(term: GlossaryTerm, q: string): number {
  const nq = q.toLowerCase();
  const t = term.term.toLowerCase();
  let best = 0;
  if (t === nq) best = 100;
  else if (t.startsWith(nq)) best = 92;
  else if (t.includes(nq)) best = 78;
  if (compact(term.term).includes(compact(q))) best = Math.max(best, 72);
  if (term.aka?.some((a) => a.toLowerCase().includes(nq))) best = Math.max(best, 70);
  if (term.summary.toLowerCase().includes(nq)) best = Math.max(best, 42);
  if (categoryLabel(term.category).toLowerCase().includes(nq)) best = Math.max(best, 36);
  return best > 0 ? best + term.popularity * 0.05 : 0;
}

export function CommandPalette({
  open,
  initialQuery = "",
  terms,
  onClose,
  onNavigate,
}: {
  open: boolean;
  initialQuery?: string;
  terms: GlossaryTerm[];
  onClose: () => void;
  onNavigate: (slug: string) => void;
}) {
  const reduce = useReducedMotion();
  const [query, setQuery] = useState(initialQuery);
  const [active, setActive] = useState(0);
  const [recent, setRecent] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Sync prefill + focus when opened; load recents.
  useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() => {
      setQuery(initialQuery);
      setActive(0);
      try {
        const raw = localStorage.getItem(RECENT_KEY);
        if (raw) setRecent(JSON.parse(raw) as string[]);
      } catch {
        /* ignore */
      }
      inputRef.current?.focus();
    });
    return () => cancelAnimationFrame(id);
  }, [open, initialQuery]);

  const trending = useMemo(() => getTrendingTerms(6), []);
  const recentTerms = useMemo(
    () => recent.map((s) => terms.find((t) => t.slug === s)).filter((t): t is GlossaryTerm => Boolean(t)),
    [recent, terms],
  );

  const results = useMemo(() => {
    if (!query.trim()) return [] as GlossaryTerm[];
    return terms
      .map((t) => ({ t, s: scoreTerm(t, query) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, 8)
      .map((x) => x.t);
  }, [query, terms]);

  // The flat, navigable list for the current state (results, or recent+trending when empty).
  const rows = query.trim() ? results : [...recentTerms, ...trending.filter((t) => !recent.includes(t.slug))].slice(0, 8);

  function go(term: GlossaryTerm) {
    try {
      const next = [term.slug, ...recent.filter((s) => s !== term.slug)].slice(0, 6);
      localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
    onNavigate(term.slug);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, rows.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (rows[active]) go(rows[active]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  }

  // Keep the active row scrolled into view.
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-row="${active}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [active]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[70] flex items-start justify-center px-4 pt-[12vh] sm:pt-[15vh]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          {/* backdrop */}
          <div
            className="absolute inset-0 bg-[rgba(12,16,26,0.32)] backdrop-blur-[3px]"
            onClick={onClose}
            aria-hidden
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Search the glossary"
            className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-[var(--hairline)] bg-white shadow-[0_24px_70px_-24px_rgba(12,16,26,0.4)]"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            onKeyDown={onKeyDown}
          >
            {/* input */}
            <div className="flex items-center gap-3 border-b border-[var(--hairline)] px-4">
              <Search className="size-[18px] shrink-0 text-[var(--ink-4)]" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActive(0);
                }}
                placeholder="Search 30+ terms — try 'AEO', 'deliverability', 'MEDDIC'…"
                aria-label="Search the glossary"
                className="h-14 min-w-0 flex-1 bg-transparent text-[15.5px] text-foreground outline-none placeholder:text-[var(--ink-4)]"
              />
              <kbd className="hidden shrink-0 rounded-md border border-[var(--hairline)] bg-[var(--tint)] px-1.5 py-0.5 font-mono text-[11px] text-[var(--ink-4)] sm:inline">
                Esc
              </kbd>
            </div>

            {/* results */}
            <div ref={listRef} className="max-h-[46vh] overflow-y-auto p-2">
              {!query.trim() && (
                <div className="px-2 pb-1 pt-2 text-[10.5px] font-bold uppercase tracking-[0.1em] text-[var(--ink-4)]">
                  {recentTerms.length ? "Recent & trending" : "Trending"}
                </div>
              )}

              {rows.length === 0 ? (
                <div className="px-3 py-10 text-center">
                  <p className="text-[14px] font-medium text-foreground">No matches for &ldquo;{query}&rdquo;</p>
                  <p className="mt-1 text-[12.5px] text-[var(--ink-4)]">Try a broader term or a category name.</p>
                </div>
              ) : (
                rows.map((term, i) => {
                  const isRecent = !query.trim() && recent.includes(term.slug);
                  return (
                    <button
                      key={term.slug}
                      type="button"
                      data-row={i}
                      onMouseMove={() => setActive(i)}
                      onClick={() => go(term)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors",
                        i === active ? "bg-[var(--cyan-tint)]" : "hover:bg-[var(--tint)]",
                      )}
                    >
                      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-white text-[var(--cyan-strong)] ring-1 ring-inset ring-[var(--cyan-line)]">
                        <CategoryIcon category={term.category} className="size-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="truncate text-[14px] font-semibold text-foreground">
                            <Highlight text={term.term} query={query} />
                          </span>
                          <DifficultyBadge difficulty={term.difficulty} className="hidden sm:inline-flex" />
                        </span>
                        <span className="mt-0.5 block truncate text-[12px] text-[var(--ink-4)]">
                          {categoryLabel(term.category)} · {term.summary}
                        </span>
                      </span>
                      <span className="shrink-0 text-[var(--ink-4)]">
                        {isRecent ? (
                          <Clock className="size-3.5" />
                        ) : !query.trim() ? (
                          <TrendingUp className="size-3.5" />
                        ) : (
                          <ArrowUpRight className="size-3.5" />
                        )}
                      </span>
                    </button>
                  );
                })
              )}
            </div>

            {/* footer hints */}
            <div className="flex items-center justify-between gap-3 border-t border-[var(--hairline)] bg-[var(--tint)] px-4 py-2.5 text-[11px] text-[var(--ink-4)]">
              <span className="inline-flex items-center gap-1.5">
                <Sparkles className="size-3.5 text-[var(--cyan-strong)]" />
                Vantera Glossary
              </span>
              <span className="hidden items-center gap-3 sm:flex">
                <span className="inline-flex items-center gap-1">
                  <Key>↑</Key>
                  <Key>↓</Key>
                  navigate
                </span>
                <span className="inline-flex items-center gap-1">
                  <Key>
                    <CornerDownLeft className="size-3" />
                  </Key>
                  open
                </span>
              </span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Key({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-grid h-4 min-w-4 place-items-center rounded border border-[var(--hairline)] bg-white px-1 font-mono text-[10px] text-[var(--ink-3)]">
      {children}
    </kbd>
  );
}
