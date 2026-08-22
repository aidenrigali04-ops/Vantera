"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  CalendarCheck2,
  ChartBar,
  CreditCard,
  Inbox,
  Plug,
  Search,
  Send,
  Settings,
  ShieldBan,
  SquareCheck,
  SquareKanban,
  Sun,
  Users,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { filterDestinations, type PaletteDestination, type PaletteKey } from "./palette-search";

/** Window event that opens the palette — dispatched by the search tile and the mobile "More" tab. */
export const OPEN_SEARCH_EVENT = "vantera:open-search";

/** Open the ⌘K palette from anywhere in the app (no-op during SSR). */
export function openCommandPalette() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(OPEN_SEARCH_EVENT));
}

const DESTINATION_ICON: Record<PaletteKey, LucideIcon> = {
  today: Sun,
  approvals: SquareCheck,
  inbox: Inbox,
  prospects: Users,
  playbook: BookOpen,
  meetings: CalendarCheck2,
  analytics: ChartBar,
  pipeline: SquareKanban,
  settings: Settings,
  senders: Send,
  billing: CreditCard,
  team: UsersRound,
  integrations: Plug,
  suppression: ShieldBan,
};

/**
 * The ⌘K search (blueprint §10): one instance, rendered by the shell. Opens on ⌘K / Ctrl+K
 * or the `vantera:open-search` event, filters the destination list as you type, arrows
 * move, Enter navigates, Escape closes. Focus stays trapped on the input (the only
 * focusable element — rows are a listbox driven by aria-activedescendant) and returns to
 * whatever had it before the palette opened. No external dependencies.
 */
export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const restoreFocusTo = useRef<HTMLElement | null>(null);
  const listId = useId();

  const results = filterDestinations(query);
  const activeIndex = results.length === 0 ? -1 : Math.min(cursor, results.length - 1);
  const activeId = activeIndex >= 0 ? `${listId}-${results[activeIndex].key}` : undefined;

  const show = useCallback(() => {
    restoreFocusTo.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setQuery("");
    setCursor(0);
    setOpen(true);
  }, []);

  const hide = useCallback(() => {
    setOpen(false);
    restoreFocusTo.current?.focus();
    restoreFocusTo.current = null;
  }, []);

  // Global triggers: the keyboard chord and the window event the tiles dispatch.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (open) hide();
        else show();
      }
    };
    const onOpenEvent = () => show();
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener(OPEN_SEARCH_EVENT, onOpenEvent);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener(OPEN_SEARCH_EVENT, onOpenEvent);
    };
  }, [open, show, hide]);

  // While open: focus the input and freeze page scroll behind the backdrop.
  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  function go(destination: PaletteDestination) {
    setOpen(false);
    restoreFocusTo.current = null;
    router.push(destination.href);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    switch (e.key) {
      case "Escape":
        e.preventDefault();
        hide();
        break;
      case "ArrowDown":
        e.preventDefault();
        if (results.length) setCursor((activeIndex + 1) % results.length);
        break;
      case "ArrowUp":
        e.preventDefault();
        if (results.length) setCursor((activeIndex - 1 + results.length) % results.length);
        break;
      case "Home":
        e.preventDefault();
        setCursor(0);
        break;
      case "End":
        e.preventDefault();
        setCursor(Math.max(results.length - 1, 0));
        break;
      case "Enter":
        e.preventDefault();
        if (activeIndex >= 0) go(results[activeIndex]);
        break;
      case "Tab":
        // the input is the only focusable element in the dialog — keep focus on it
        e.preventDefault();
        break;
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center bg-[rgb(11_11_13/0.2)] px-4 pt-[15vh]"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) hide();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search"
        onKeyDown={onKeyDown}
        className="w-full max-w-[560px] rounded-[var(--r-card)] bg-[var(--surface)] p-2 shadow-[var(--shadow-card)] ring-1 ring-[var(--line)]"
      >
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--ink-dim)]"
            strokeWidth={1.75}
            aria-hidden="true"
          />
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-activedescendant={activeId}
            aria-autocomplete="list"
            aria-label="Search destinations"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            placeholder="Go to…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setCursor(0);
            }}
            className="h-10 w-full rounded-[var(--r-btn)] bg-[var(--surface)] pl-9 pr-14 text-sm text-[var(--ink)] ring-1 ring-[var(--line)] placeholder:text-[var(--ink-dim)] focus-visible:shadow-[var(--focus-ring)] focus-visible:outline-none"
          />
          <kbd className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded-[var(--r-chip)] bg-[var(--surface-2)] px-1.5 py-0.5 font-mono text-[11px] text-[var(--ink-dim)]">
            esc
          </kbd>
        </div>

        <ul id={listId} role="listbox" aria-label="Destinations" className="mt-2 max-h-[min(60vh,400px)] overflow-y-auto">
          {results.length === 0 ? (
            <li className="px-3 py-6 text-center text-sm text-[var(--ink-mid)]">No matches for “{query.trim()}”</li>
          ) : (
            results.map((destination, index) => {
              const Icon = DESTINATION_ICON[destination.key];
              const active = index === activeIndex;
              return (
                <li
                  key={destination.key}
                  id={`${listId}-${destination.key}`}
                  role="option"
                  aria-selected={active}
                  onPointerMove={() => {
                    if (!active) setCursor(index);
                  }}
                  onClick={() => go(destination)}
                  className={cn(
                    "flex h-10 cursor-pointer items-center gap-3 rounded-[var(--r-btn)] px-3 text-sm text-[var(--ink)]",
                    active && "bg-[var(--surface-2)]"
                  )}
                >
                  <Icon className="size-4 shrink-0 text-[var(--ink-mid)]" strokeWidth={1.75} aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate">{destination.label}</span>
                  <span className="shrink-0 font-mono text-xs text-[var(--ink-dim)]">{destination.href}</span>
                </li>
              );
            })
          )}
        </ul>
      </div>
    </div>
  );
}
