"use client";

import { useCallback, useEffect, useId, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, Pause, Play, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { CHROME_FOCUS, CHROME_MENU, CHROME_MENU_ITEM, CHROME_MOTION, CHROME_PILL } from "./tile";
import { useDismiss, type DismissReason } from "./use-dismiss";
import { WorkspaceIcon } from "./workspace-icon";

/** A server action that flips the workspace engine; resolves to `{}` or a user-facing error. */
export type EngineAction = () => Promise<{ error?: string }>;

export type WorkspacePillProps = {
  name: string;
  paused: boolean;
  /** Icon URLs to try, in order (scanned icon, else the domain's conventional paths). */
  iconCandidates?: string[];
  pauseEngine: EngineAction;
  resumeEngine: EngineAction;
};

/**
 * The workspace switcher-shaped pill (blueprint §6.1): icon square · name · chevron. Its
 * menu holds the one workspace-level control that matters day to day — pausing and
 * resuming the engine — plus the settings link. The pause stamp lives on the account
 * (`accounts.paused_at`); the actions are passed in from the server layout.
 */
export function WorkspacePill({ name, paused, iconCandidates = [], pauseEngine, resumeEngine }: WorkspacePillProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const focusFirstItem = useRef(false);
  const buttonId = useId();
  const menuId = useId();

  const close = useCallback((restoreFocus: boolean) => {
    setOpen(false);
    setError(null);
    if (restoreFocus) buttonRef.current?.focus();
  }, []);

  const onDismiss = useCallback((reason: DismissReason) => close(reason === "escape"), [close]);
  useDismiss(open, rootRef, onDismiss);

  // Keyboard open (ArrowDown / Enter / Space) lands focus on the first item, per the
  // WAI-ARIA menu-button pattern; a pointer open leaves focus on the trigger.
  useEffect(() => {
    if (!open || !focusFirstItem.current) return;
    focusFirstItem.current = false;
    rootRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
  }, [open]);

  function openFromKeyboard() {
    focusFirstItem.current = true;
    setOpen(true);
  }

  function onTriggerKeyDown(e: React.KeyboardEvent<HTMLButtonElement>) {
    if (e.key === "ArrowDown" || (!open && (e.key === "Enter" || e.key === " "))) {
      e.preventDefault();
      openFromKeyboard();
    }
  }

  function onMenuKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp" && e.key !== "Home" && e.key !== "End") return;
    const items = Array.from(rootRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
    if (items.length === 0) return;
    e.preventDefault();
    const current = items.indexOf(document.activeElement as HTMLElement);
    const next =
      e.key === "Home"
        ? 0
        : e.key === "End"
          ? items.length - 1
          : e.key === "ArrowDown"
            ? (current + 1) % items.length
            : (current - 1 + items.length) % items.length;
    items[next]?.focus();
  }

  function toggleEngine() {
    startTransition(async () => {
      setError(null);
      const result = await (paused ? resumeEngine() : pauseEngine());
      if (result.error) {
        setError(result.error);
        return;
      }
      close(true);
      router.refresh();
    });
  }

  const engineLabel = pending ? (paused ? "Resuming…" : "Pausing…") : paused ? "Resume engine" : "Pause engine";
  const EngineIcon = paused ? Play : Pause;

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        id={buttonId}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => (open ? close(false) : setOpen(true))}
        onKeyDown={onTriggerKeyDown}
        className={cn(
          CHROME_PILL,
          "py-1 pl-1 pr-3 text-left hover:ring-[var(--line-strong)]",
          CHROME_MOTION,
          CHROME_FOCUS,
          open && "ring-[var(--line-strong)]"
        )}
      >
        <span className="grid size-8 shrink-0 place-items-center overflow-hidden rounded-[var(--r-btn)] bg-[var(--surface-2)] text-[var(--ink-mid)]">
          <WorkspaceIcon candidates={iconCandidates} className="size-4.5 object-contain" />
        </span>
        <span className="ml-2 flex min-w-0 items-center gap-1.5">
          {paused && (
            <span
              role="img"
              aria-label="Engine paused"
              title="Engine paused"
              className="size-1.5 shrink-0 rounded-full bg-[var(--attention)]"
            />
          )}
          <span className="max-w-[22ch] truncate text-sm font-medium text-[var(--ink)]">{name}</span>
        </span>
        <ChevronDown
          className={cn(
            "ml-1.5 size-3.5 shrink-0 text-[var(--ink-dim)] transition-transform duration-120 ease-out",
            open && "rotate-180"
          )}
          strokeWidth={1.75}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div
          id={menuId}
          role="menu"
          aria-labelledby={buttonId}
          onKeyDown={onMenuKeyDown}
          className={cn(CHROME_MENU, "left-0")}
        >
          <p className="truncate px-2.5 pb-2 pt-1.5 text-[13px] text-[var(--ink-dim)]">{name}</p>
          <div role="separator" className="mx-1 mb-1 h-px bg-[var(--line)]" />
          <button
            type="button"
            role="menuitem"
            disabled={pending}
            aria-busy={pending || undefined}
            onClick={toggleEngine}
            className={CHROME_MENU_ITEM}
          >
            <EngineIcon className="size-4 text-[var(--ink-mid)]" strokeWidth={1.75} aria-hidden="true" />
            <span className={cn(pending && "text-[var(--ink-mid)]")}>{engineLabel}</span>
          </button>
          {error && (
            <p role="alert" className="px-2.5 py-1.5 text-[13px] leading-snug text-[var(--danger)]">
              {error}
            </p>
          )}
          <Link href="/settings" role="menuitem" onClick={() => close(false)} className={CHROME_MENU_ITEM}>
            <Settings className="size-4 text-[var(--ink-mid)]" strokeWidth={1.75} aria-hidden="true" />
            Workspace settings
          </Link>
        </div>
      )}
    </div>
  );
}
