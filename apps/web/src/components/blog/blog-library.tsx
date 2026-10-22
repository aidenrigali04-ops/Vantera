"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { Search, X } from "lucide-react";
import { Band, CELL, CellGrid, Spacer } from "@/components/landing/frame";
import { Reveal, RevealItem } from "@/components/landing/surface";
import { cn } from "@/lib/utils";
import { PostCard, type PostMeta } from "./post-cards";

/**
 * The blog index's library, after rankbox.xyz's: a header band with search, a band of
 * topic chips with counts, then the hairline grid. Filtering is client-side; the topic
 * lives in `?topic=` (the URL is its only store, read through useSyncExternalStore) so
 * a post's breadcrumb can link straight to its topic, and the page itself stays static:
 * the server renders every article, the client narrows once hydrated.
 */

/* Fired after a chip rewrites the URL, so the store re-reads it. */
const TOPIC_EVENT = "blog:topic";

function subscribe(onChange: () => void) {
  window.addEventListener("popstate", onChange);
  window.addEventListener(TOPIC_EVENT, onChange);
  return () => {
    window.removeEventListener("popstate", onChange);
    window.removeEventListener(TOPIC_EVENT, onChange);
  };
}

const readTopic = () => new URLSearchParams(window.location.search).get("topic");
const serverTopic = () => null;

function topicCounts(posts: PostMeta[]): { topic: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const p of posts) counts.set(p.category, (counts.get(p.category) ?? 0) + 1);
  return [...counts]
    .map(([topic, count]) => ({ topic, count }))
    .sort((a, b) => b.count - a.count || a.topic.localeCompare(b.topic));
}

const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(24,119,242,0.4)]";

function chip(on: boolean) {
  return cn(
    "inline-flex h-8 shrink-0 items-center gap-2 whitespace-nowrap rounded-lg border px-3 text-[0.82rem] font-medium transition-colors",
    FOCUS,
    on
      ? "border-[rgba(22,111,229,0.25)] bg-[var(--cyan-tint)] text-[var(--fb-strong)]"
      : "border-[rgba(12,16,26,0.08)] bg-white text-foreground/75 hover:border-[rgba(12,16,26,0.16)] hover:text-foreground",
  );
}

function SearchField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <label className="relative block w-full md:w-72">
      <span className="sr-only">Search articles</span>
      <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[var(--ink-3)]" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search articles"
        className="h-10 w-full rounded-lg border border-[rgba(12,16,26,0.1)] bg-white pl-10 pr-9 text-sm text-foreground shadow-[0_1px_2px_rgba(16,24,40,0.04)] outline-none transition-[border-color,box-shadow] placeholder:text-[var(--ink-3)] hover:border-[rgba(12,16,26,0.16)] focus:border-[var(--cyan-line)] focus:shadow-[0_0_0_4px_var(--fb-tint)] [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear search"
          className={cn(
            "absolute right-2 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-[var(--ink-3)] hover:bg-[rgba(12,16,26,0.04)] hover:text-foreground",
            FOCUS,
          )}
        >
          <X className="size-3.5" />
        </button>
      )}
    </label>
  );
}

export function BlogLibrary({ posts, featuredSlug }: { posts: PostMeta[]; featuredSlug?: string }) {
  const [query, setQuery] = useState("");
  const topics = useMemo(() => topicCounts(posts), [posts]);
  const asked = useSyncExternalStore(subscribe, readTopic, serverTopic);
  // A topic no post carries (a stale link) reads as no topic.
  const topic = asked && topics.some((t) => t.topic === asked) ? asked : undefined;

  const choose = (next?: string) => {
    const url = new URL(window.location.href);
    if (next) url.searchParams.set("topic", next);
    else url.searchParams.delete("topic");
    history.replaceState(null, "", url);
    window.dispatchEvent(new Event(TOPIC_EVENT));
  };

  const q = query.trim().toLowerCase();
  const filtering = !!topic || !!q;
  const results = posts.filter(
    (p) =>
      (!topic || p.category === topic) &&
      (!q || `${p.title} ${p.description} ${p.category}`.toLowerCase().includes(q)),
  );
  // Unfiltered, the lead story sits above; the grid holds everything else.
  const grid = filtering ? results : results.filter((p) => p.slug !== featuredSlug);

  return (
    <section id="articles" aria-labelledby="articles-title" className="scroll-mt-16">
      <Spacer />
      <Band inner="flex flex-col gap-5 px-6 py-8 sm:px-10 md:flex-row md:items-end md:justify-between lg:px-12">
        <div>
          <h2
            id="articles-title"
            className="text-[1.6rem] font-medium leading-tight tracking-[-0.025em] text-foreground sm:text-[1.9rem]"
          >
            {topic ?? (filtering ? "Search results" : "Latest articles")}
          </h2>
          <p className="mt-1.5 text-sm text-[var(--ink-3)]" aria-live="polite">
            {filtering
              ? `${results.length} ${results.length === 1 ? "article" : "articles"}${q ? ` matching “${query.trim()}”` : ""}`
              : "Playbooks, research, and how-tos from the Vantera team."}
          </p>
        </div>
        <SearchField value={query} onChange={setQuery} />
      </Band>

      {topics.length > 1 && (
        <Band inner="px-6 py-3.5 sm:px-10 lg:px-12">
          <nav
            aria-label="Topics"
            className="-mx-6 overflow-x-auto px-6 [scrollbar-width:none] sm:-mx-10 sm:px-10 lg:-mx-12 lg:px-12"
          >
            <ul className="flex gap-2">
              <li>
                <button
                  type="button"
                  aria-pressed={!topic}
                  onClick={() => choose(undefined)}
                  className={chip(!topic)}
                >
                  All{" "}
                  <span className={cn("text-xs tabular-nums", !topic ? "text-[var(--fb-strong)]/70" : "text-[var(--ink-3)]")}>
                    {posts.length}
                  </span>
                </button>
              </li>
              {topics.map(({ topic: t, count }) => {
                const on = topic === t;
                return (
                  <li key={t}>
                    <button
                      type="button"
                      aria-pressed={on}
                      onClick={() => choose(on ? undefined : t)}
                      className={chip(on)}
                    >
                      {t}{" "}
                      <span className={cn("text-xs tabular-nums", on ? "text-[var(--fb-strong)]/70" : "text-[var(--ink-3)]")}>
                        {count}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>
        </Band>
      )}

      <Band>
        {grid.length > 0 ? (
          <Reveal>
            <CellGrid className="sm:grid-cols-2 lg:grid-cols-3">
              {grid.map((p, i) => (
                <li key={p.slug} className={CELL}>
                  <RevealItem className="h-full" style={{ transitionDelay: `${(i % 3) * 0.05}s` }}>
                    <PostCard post={p} />
                  </RevealItem>
                </li>
              ))}
            </CellGrid>
          </Reveal>
        ) : (
          <div className="px-6 py-16 text-center">
            <p className="text-lg font-medium text-foreground">
              {filtering ? "No articles match that yet" : "More articles are on the way"}
            </p>
            <p className="mx-auto mt-2 max-w-sm text-sm text-[var(--ink-3)]">
              {filtering
                ? "Try a different word, or browse every topic."
                : "We publish new playbooks regularly. Check back soon."}
            </p>
            {filtering && (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  choose(undefined);
                }}
                className={cn(
                  "mt-6 inline-flex h-10 items-center rounded-lg bg-[var(--fb-strong)] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#1161cc]",
                  FOCUS,
                )}
              >
                Clear filters
              </button>
            )}
          </div>
        )}
      </Band>
    </section>
  );
}
