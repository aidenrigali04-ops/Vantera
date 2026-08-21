"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Bookmark, ChevronRight, Clock, Search, SlidersHorizontal, TrendingUp, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Reveal, RevealItem } from "@/components/landing/surface";
import {
  GLOSSARY_CATEGORIES,
  type CategoryKey,
  type Difficulty,
  type GlossaryTerm,
  categoryLabel,
} from "@/lib/glossary";
import { TermCard } from "./term-card";
import { CategoryIcon, useBookmarks } from "./glossary-ui";

type CategoryFilter = "all" | CategoryKey;
type DifficultyFilter = "all" | Difficulty;
type SortKey = "popular" | "recent" | "az" | "time";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "popular", label: "Most popular" },
  { key: "recent", label: "Recently added" },
  { key: "az", label: "Alphabetical" },
  { key: "time", label: "Quickest read" },
];

const DIFFICULTIES: DifficultyFilter[] = ["all", "Beginner", "Intermediate", "Advanced"];

function sortTerms(list: GlossaryTerm[], sort: SortKey): GlossaryTerm[] {
  const copy = [...list];
  switch (sort) {
    case "recent":
      return copy.sort((a, b) => b.updated.localeCompare(a.updated));
    case "az":
      return copy.sort((a, b) => a.term.localeCompare(b.term));
    case "time":
      return copy.sort((a, b) => a.readingTime - b.readingTime);
    default:
      return copy.sort((a, b) => b.popularity - a.popularity);
  }
}

function matchesQuery(t: GlossaryTerm, q: string): boolean {
  if (!q.trim()) return true;
  const n = q.toLowerCase();
  return (
    t.term.toLowerCase().includes(n) ||
    t.summary.toLowerCase().includes(n) ||
    categoryLabel(t.category).toLowerCase().includes(n) ||
    (t.aka?.some((a) => a.toLowerCase().includes(n)) ?? false)
  );
}

export function GlossaryDirectory({
  terms,
  trending,
  recent,
  onOpenSearch,
}: {
  terms: GlossaryTerm[];
  trending: GlossaryTerm[];
  recent: GlossaryTerm[];
  onOpenSearch: (query?: string) => void;
}) {
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [difficulty, setDifficulty] = useState<DifficultyFilter>("all");
  const [sort, setSort] = useState<SortKey>("popular");
  const [query, setQuery] = useState("");

  // Honor a `?q=` deep link (e.g. the WebSite SearchAction target) without making the page
  // dynamic — read it on the client after hydration and apply it as the inline filter.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("q");
    if (!q) return;
    const id = requestAnimationFrame(() => setQuery(q));
    return () => cancelAnimationFrame(id);
  }, []);

  const counts = useMemo(() => {
    const m = new Map<CategoryKey, number>();
    for (const t of terms) m.set(t.category, (m.get(t.category) ?? 0) + 1);
    return m;
  }, [terms]);

  const filtered = useMemo(
    () =>
      terms.filter(
        (t) =>
          (category === "all" || t.category === category) &&
          (difficulty === "all" || t.difficulty === difficulty) &&
          matchesQuery(t, query),
      ),
    [terms, category, difficulty, query],
  );

  const grouped = category === "all" && !query.trim();
  const filtersActive = category !== "all" || difficulty !== "all" || query.trim() !== "";

  function clearFilters() {
    setCategory("all");
    setDifficulty("all");
    setQuery("");
  }

  return (
    <section id="browse" className="relative border-t border-[var(--hairline)] bg-[var(--tint)] py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-6 lg:px-8">
        <div className="lg:grid lg:grid-cols-[236px_1fr] lg:gap-10">
          {/* ── Sidebar ─────────────────────────────────────────────── */}
          <aside className="hidden self-start lg:sticky lg:top-28 lg:block">
            <DirNav
              category={category}
              setCategory={setCategory}
              counts={counts}
              total={terms.length}
              trending={trending}
              recent={recent}
              onOpenSearch={onOpenSearch}
            />
          </aside>

          {/* ── Main ───────────────────────────────────────────────── */}
          <div className="min-w-0">
            {/* mobile category pills */}
            <div className="-mx-6 mb-5 flex gap-2 overflow-x-auto px-6 lg:hidden">
              <Pill active={category === "all"} onClick={() => setCategory("all")}>
                All
              </Pill>
              {GLOSSARY_CATEGORIES.map((c) => (
                <Pill key={c.key} active={category === c.key} onClick={() => setCategory(c.key)}>
                  {c.label}
                </Pill>
              ))}
            </div>

            {/* filter bar */}
            <div className="mb-6 flex flex-wrap items-center gap-3">
              <div className="flex min-w-[200px] flex-1 items-center gap-2 rounded-xl border border-[var(--hairline)] bg-white px-3.5 py-2.5 shadow-[var(--shadow-sm)] transition-shadow focus-within:border-[var(--cyan-line)] focus-within:shadow-[0_0_0_3px_rgba(24,119,242,0.12)]">
                <Search className="size-4 shrink-0 text-[var(--ink-4)]" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Filter terms…"
                  aria-label="Filter terms"
                  className="min-w-0 flex-1 bg-transparent text-[14px] text-foreground outline-none placeholder:text-[var(--ink-4)]"
                />
                {query && (
                  <button type="button" onClick={() => setQuery("")} aria-label="Clear filter" className="text-[var(--ink-4)] hover:text-[var(--ink-2)]">
                    <X className="size-4" />
                  </button>
                )}
              </div>

              <label className="relative inline-flex items-center">
                <SlidersHorizontal className="pointer-events-none absolute left-3 size-3.5 text-[var(--ink-4)]" />
                <select
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value as DifficultyFilter)}
                  aria-label="Filter by difficulty"
                  className="appearance-none rounded-xl border border-[var(--hairline)] bg-white py-2.5 pl-9 pr-8 text-[13.5px] font-medium text-[var(--ink-2)] shadow-[var(--shadow-sm)] outline-none transition-colors hover:border-[var(--cyan-line)]"
                >
                  {DIFFICULTIES.map((d) => (
                    <option key={d} value={d}>
                      {d === "all" ? "All levels" : d}
                    </option>
                  ))}
                </select>
                <ChevronRight className="pointer-events-none absolute right-2.5 size-3.5 rotate-90 text-[var(--ink-4)]" />
              </label>

              <label className="relative inline-flex items-center">
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as SortKey)}
                  aria-label="Sort terms"
                  className="appearance-none rounded-xl border border-[var(--hairline)] bg-white py-2.5 pl-3.5 pr-8 text-[13.5px] font-medium text-[var(--ink-2)] shadow-[var(--shadow-sm)] outline-none transition-colors hover:border-[var(--cyan-line)]"
                >
                  {SORTS.map((s) => (
                    <option key={s.key} value={s.key}>
                      {s.label}
                    </option>
                  ))}
                </select>
                <ChevronRight className="pointer-events-none absolute right-2.5 size-3.5 rotate-90 text-[var(--ink-4)]" />
              </label>
            </div>

            {/* results */}
            {grouped ? (
              <div className="flex flex-col gap-12">
                {GLOSSARY_CATEGORIES.map((c) => {
                  const list = sortTerms(
                    filtered.filter((t) => t.category === c.key),
                    sort,
                  );
                  if (list.length === 0) return null;
                  return (
                    <div key={c.key}>
                      <div className="mb-4 flex items-center gap-3">
                        <span className="grid size-9 place-items-center rounded-xl bg-[var(--cyan-tint)] text-[var(--cyan-strong)] ring-1 ring-inset ring-[var(--cyan-line)]">
                          <CategoryIcon category={c.key} className="size-[18px]" />
                        </span>
                        <div>
                          <h2 className="text-[18px] font-semibold tracking-[-0.015em] text-foreground">{c.label}</h2>
                          <p className="text-[12.5px] text-[var(--ink-4)]">{c.tagline}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setCategory(c.key)}
                          className="ml-auto hidden shrink-0 items-center gap-1 text-[12.5px] font-semibold text-[var(--cyan-strong)] hover:text-[var(--fb-strong)] sm:inline-flex"
                        >
                          {list.length} terms
                          <ChevronRight className="size-3.5" />
                        </button>
                      </div>
                      <Reveal className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                        {list.map((t) => (
                          <RevealItem key={t.slug} className="h-full">
                            <TermCard term={t} />
                          </RevealItem>
                        ))}
                      </Reveal>
                    </div>
                  );
                })}
              </div>
            ) : (
              <>
                <div className="mb-4 flex items-center justify-between gap-3">
                  <p className="text-[13.5px] text-[var(--ink-3)]">
                    <span className="font-semibold text-foreground">{filtered.length}</span>{" "}
                    {filtered.length === 1 ? "term" : "terms"}
                    {category !== "all" && <> in {categoryLabel(category as CategoryKey)}</>}
                  </p>
                  {filtersActive && (
                    <button
                      type="button"
                      onClick={clearFilters}
                      className="inline-flex items-center gap-1 text-[12.5px] font-medium text-[var(--ink-4)] hover:text-foreground"
                    >
                      <X className="size-3.5" />
                      Clear filters
                    </button>
                  )}
                </div>
                {filtered.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-[var(--hairline)] bg-white/60 px-6 py-16 text-center">
                    <p className="text-[15px] font-medium text-foreground">No terms match those filters.</p>
                    <button type="button" onClick={clearFilters} className="mt-3 text-[13.5px] font-semibold text-[var(--cyan-strong)]">
                      Reset filters
                    </button>
                  </div>
                ) : (
                  <Reveal className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {sortTerms(filtered, sort).map((t) => (
                      <RevealItem key={t.slug} className="h-full">
                        <TermCard term={t} query={query} />
                      </RevealItem>
                    ))}
                  </Reveal>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors",
        active
          ? "bg-[#0a0c12] text-white shadow-[var(--shadow-sm)]"
          : "border border-[var(--hairline)] bg-white text-[var(--ink-2)] hover:border-[var(--cyan-line)]",
      )}
    >
      {children}
    </button>
  );
}

function DirNav({
  category,
  setCategory,
  counts,
  total,
  trending,
  recent,
  onOpenSearch,
}: {
  category: CategoryFilter;
  setCategory: (c: CategoryFilter) => void;
  counts: Map<CategoryKey, number>;
  total: number;
  trending: GlossaryTerm[];
  recent: GlossaryTerm[];
  onOpenSearch: (query?: string) => void;
}) {
  const { bookmarks } = useBookmarks();

  return (
    <nav className="flex flex-col gap-6 text-[13.5px]">
      <button
        type="button"
        onClick={() => onOpenSearch("")}
        className="flex items-center gap-2 rounded-xl border border-[var(--hairline)] bg-white px-3 py-2.5 text-left text-[var(--ink-4)] shadow-[var(--shadow-sm)] transition-colors hover:border-[var(--cyan-line)]"
      >
        <Search className="size-4" />
        <span className="flex-1 text-[13.5px]">Search…</span>
        <kbd className="rounded border border-[var(--hairline)] bg-[var(--tint)] px-1.5 font-mono text-[11px]">⌘K</kbd>
      </button>

      <div>
        <SideHeading>Categories</SideHeading>
        <ul className="mt-2 flex flex-col gap-0.5">
          <SideItem active={category === "all"} onClick={() => setCategory("all")} count={total}>
            All terms
          </SideItem>
          {GLOSSARY_CATEGORIES.map((c) => (
            <SideItem key={c.key} active={category === c.key} onClick={() => setCategory(c.key)} count={counts.get(c.key) ?? 0} icon={c.key}>
              {c.label}
            </SideItem>
          ))}
        </ul>
      </div>

      <SideLinkList heading="Trending" icon={<TrendingUp className="size-3.5" />} terms={trending.slice(0, 5)} />
      <SideLinkList heading="Recently added" icon={<Clock className="size-3.5" />} terms={recent.slice(0, 4)} />

      <div>
        <SideHeading>
          <Bookmark className="size-3.5" />
          Bookmarks
        </SideHeading>
        {bookmarks.length === 0 ? (
          <p className="mt-2 text-[12.5px] leading-relaxed text-[var(--ink-4)]">
            Bookmark a term to pin it here for later.
          </p>
        ) : (
          <ul className="mt-2 flex flex-col gap-1.5">
            {bookmarks.slice(0, 6).map((slug) => (
              <li key={slug}>
                <Link href={`/glossary/${slug}`} className="text-[13px] text-[var(--ink-3)] transition-colors hover:text-[var(--cyan-strong)]">
                  {slug.replace(/-/g, " ")}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </nav>
  );
}

function SideHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--ink-4)]">
      {children}
    </h3>
  );
}

function SideItem({
  active,
  onClick,
  count,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  count: number;
  icon?: CategoryKey;
  children: React.ReactNode;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        aria-current={active ? "true" : undefined}
        className={cn(
          "flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left transition-colors",
          active ? "bg-white font-semibold text-foreground shadow-[var(--shadow-sm)]" : "text-[var(--ink-3)] hover:bg-white/60 hover:text-foreground",
        )}
      >
        {icon && <CategoryIcon category={icon} className={cn("size-3.5", active ? "text-[var(--cyan-strong)]" : "text-[var(--ink-4)]")} />}
        <span className="flex-1">{children}</span>
        <span className="tabular-nums text-[11.5px] text-[var(--ink-4)]">{count}</span>
      </button>
    </li>
  );
}

function SideLinkList({ heading, icon, terms }: { heading: string; icon: React.ReactNode; terms: GlossaryTerm[] }) {
  return (
    <div>
      <SideHeading>
        {icon}
        {heading}
      </SideHeading>
      <ul className="mt-2 flex flex-col gap-1.5">
        {terms.map((t) => (
          <li key={t.slug}>
            <Link href={`/glossary/${t.slug}`} className="line-clamp-1 text-[13px] text-[var(--ink-3)] transition-colors hover:text-[var(--cyan-strong)]">
              {t.term}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
