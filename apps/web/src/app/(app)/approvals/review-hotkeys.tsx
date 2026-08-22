"use client";

import { useEffect, useRef, useState } from "react";

/**
 * R4: keyboard flow for Approvals — clearing 20 prospects was a pure
 * expand-click-click grind. j/k move between prospect cards, Enter/o toggles the focused
 * card, a approves / d declines / e edits its first visible draft (auto-expanding first),
 * ? shows the map. DOM-driven on the server-rendered cards (data-review-group wrappers +
 * the buttons' existing data attributes), so the cards stay server components.
 */
export function ReviewHotkeys() {
  const [showHint, setShowHint] = useState(false);
  const idx = useRef(-1);

  useEffect(() => {
    const cards = () => [...document.querySelectorAll<HTMLElement>("[data-review-group]")];

    const focusCard = (i: number) => {
      const list = cards();
      if (list.length === 0) return;
      idx.current = Math.max(0, Math.min(i, list.length - 1));
      const header = list[idx.current]?.querySelector<HTMLButtonElement>("button[aria-expanded]");
      header?.focus();
      list[idx.current]?.scrollIntoView({ block: "nearest" });
    };

    const withOpenCard = (fn: (card: HTMLElement) => void) => {
      const card = cards()[idx.current];
      if (!card) return;
      const header = card.querySelector<HTMLButtonElement>("button[aria-expanded]");
      if (header?.getAttribute("aria-expanded") === "false") {
        header.click();
        // draft controls mount on expand — act on the next frame
        requestAnimationFrame(() => fn(card));
      } else {
        fn(card);
      }
    };

    const clickIn = (card: HTMLElement, selector: string) =>
      card.querySelector<HTMLButtonElement>(selector)?.click();

    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.isContentEditable ||
        document.querySelector('[role="alertdialog"]')
      ) {
        return;
      }
      switch (e.key) {
        case "j":
          e.preventDefault();
          focusCard(idx.current + 1);
          break;
        case "k":
          e.preventDefault();
          focusCard(idx.current - 1);
          break;
        case "o":
        case "Enter": {
          if (idx.current < 0) return;
          e.preventDefault();
          cards()[idx.current]?.querySelector<HTMLButtonElement>("button[aria-expanded]")?.click();
          break;
        }
        case "a":
          if (idx.current < 0) return;
          e.preventDefault();
          withOpenCard((card) => clickIn(card, '[data-copilot="approve-draft"]'));
          break;
        case "d":
          if (idx.current < 0) return;
          e.preventDefault();
          withOpenCard((card) => clickIn(card, '[data-hotkey="decline-draft"]'));
          break;
        case "e":
          if (idx.current < 0) return;
          e.preventDefault();
          withOpenCard((card) => clickIn(card, '[data-hotkey="edit-draft"]'));
          break;
        case "?":
          e.preventDefault();
          setShowHint((s) => !s);
          break;
        case "Escape":
          setShowHint(false);
          break;
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="pointer-events-none fixed bottom-20 left-1/2 z-40 -translate-x-1/2 lg:bottom-6">
      {showHint ? (
        <div className="pointer-events-auto rounded-xl border border-[var(--hairline)] bg-white px-4 py-2.5 text-xs shadow-lg">
          <span className="font-medium">Keyboard:</span>{" "}
          <kbd className="rounded bg-foreground/10 px-1">j</kbd>/<kbd className="rounded bg-foreground/10 px-1">k</kbd> move ·{" "}
          <kbd className="rounded bg-foreground/10 px-1">enter</kbd> open ·{" "}
          <kbd className="rounded bg-foreground/10 px-1">a</kbd> approve ·{" "}
          <kbd className="rounded bg-foreground/10 px-1">d</kbd> decline ·{" "}
          <kbd className="rounded bg-foreground/10 px-1">e</kbd> edit ·{" "}
          <kbd className="rounded bg-foreground/10 px-1">?</kbd> hide
        </div>
      ) : (
        <p className="hidden text-[11px] text-muted-foreground/70 lg:block">
          press <kbd className="rounded bg-foreground/10 px-1">?</kbd> for keyboard review
        </p>
      )}
    </div>
  );
}
