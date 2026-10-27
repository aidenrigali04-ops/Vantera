"use client";

import { useCallback, useEffect, useId, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Pause, Play } from "lucide-react";
import type { ChipState, EngineGroups, GroupState } from "@/lib/engine/chip-state";
import { cn } from "@/lib/utils";
import { StatusChip, useChipDetail } from "./status-chip";
import { CHROME_FOCUS, CHROME_MENU, CHROME_MENU_ITEM, CHROME_MOTION } from "./tile";
import { useDismiss, type DismissReason } from "./use-dismiss";

/** A server action that flips the workspace engine; resolves to `{}` or a user-facing error. */
export type EngineAction = () => Promise<{ error?: string }>;

/** The popover's switch action: a whole agent group on or off; `{}` or a user-facing error. */
export type GroupAction = (group: "sourcing" | "outreach", status: "live" | "paused") => Promise<{ error?: string }>;

export type EnginePopoverProps = {
  chip: ChipState;
  groups: EngineGroups;
  /** `accounts.paused_at` is set */
  paused: boolean;
  pauseEngine: EngineAction;
  resumeEngine: EngineAction;
  setAgentGroup: GroupAction;
  variant?: "band" | "compact";
};

const GROUP_ROWS = [
  { group: "sourcing", title: "Sourcing", sub: "Prospect + Intent agents" },
  { group: "outreach", title: "Outreach", sub: "Outreach agent" },
] as const;

/**
 * The run-state chip and its popover (UX-2 Task 9): the chip says what the engine is doing;
 * the popover holds the two group switches (Sourcing, Outreach) and "Pause everything /
 * Resume everything". Hand-rolled on the chrome's menu model (`useDismiss`, Escape returns
 * focus to the chip). Every action revalidates the layout; `router.refresh()` repaints now.
 */
export function EnginePopover({
  chip,
  groups,
  paused,
  pauseEngine,
  resumeEngine,
  setAgentGroup,
  variant = "band",
}: EnginePopoverProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"sourcing" | "outreach" | "engine" | null>(null);
  const [, startTransition] = useTransition();
  const rootRef = useRef<HTMLDivElement>(null);
  const chipRef = useRef<HTMLButtonElement>(null);
  const focusFirst = useRef(false);
  const panelId = useId();
  const detail = useChipDetail(chip);

  const close = useCallback((restoreFocus: boolean) => {
    setOpen(false);
    setError(null);
    if (restoreFocus) chipRef.current?.focus();
  }, []);
  const onDismiss = useCallback((reason: DismissReason) => close(reason === "escape"), [close]);
  useDismiss(open, rootRef, onDismiss);

  // A keyboard open lands focus on the first control; a pointer open leaves it on the chip.
  useEffect(() => {
    if (!open || !focusFirst.current) return;
    focusFirst.current = false;
    rootRef.current?.querySelector<HTMLElement>("[data-engine-control]:not(:disabled)")?.focus();
  }, [open]);

  function onChipKeyDown(e: React.KeyboardEvent<HTMLButtonElement>) {
    if (e.key === "ArrowDown" || (!open && (e.key === "Enter" || e.key === " "))) {
      e.preventDefault();
      focusFirst.current = true;
      setOpen(true);
    }
  }

  function run(key: "sourcing" | "outreach" | "engine", action: () => Promise<{ error?: string }>) {
    setBusy(key);
    setError(null);
    startTransition(async () => {
      const result = await action();
      setBusy(null);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  const compact = variant === "compact";

  return (
    <div ref={rootRef} className={cn("relative", compact && "min-w-0")}>
      <StatusChip
        ref={chipRef}
        chip={chip}
        expanded={open}
        controls={open ? panelId : undefined}
        variant={variant}
        onClick={() => (open ? close(false) : setOpen(true))}
        onKeyDown={onChipKeyDown}
      />

      {open && (
        <div
          id={panelId}
          role="dialog"
          aria-label="Engine"
          className={cn(
            CHROME_MENU,
            compact ? "fixed inset-x-4 top-14 mt-0 w-auto" : "right-0 w-80",
            "p-1.5"
          )}
        >
          <div className="px-2.5 pb-2.5 pt-1.5">
            <p className="text-sm font-medium text-[var(--ink)]">{chip.label}</p>
            {detail && <p className="mt-0.5 text-[13px] tabular-nums text-[var(--ink-dim)]">{detail}</p>}
            {chip.href && chip.detail && (
              <Link
                href={chip.href}
                data-engine-control
                onClick={() => close(false)}
                className={cn(
                  "mt-2 inline-flex items-center gap-1 rounded-[var(--r-btn)] text-[13px] font-medium text-[var(--acc-ink)] hover:underline",
                  CHROME_FOCUS
                )}
              >
                {chip.detail}
                <ArrowRight className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
              </Link>
            )}
          </div>

          <div role="separator" className="mx-1 mb-1 h-px bg-[var(--line)]" />

          {GROUP_ROWS.map(({ group, title, sub }) => (
            <GroupSwitch
              key={group}
              title={title}
              sub={sub}
              state={groups[group]}
              busy={busy === group}
              disabled={busy !== null}
              lockedHint={paused ? "Resume everything first" : null}
              onToggle={(next) => run(group, () => setAgentGroup(group, next))}
            />
          ))}

          <div role="separator" className="mx-1 my-1 h-px bg-[var(--line)]" />

          <button
            type="button"
            data-engine-control
            disabled={busy !== null}
            aria-busy={busy === "engine" || undefined}
            onClick={() => run("engine", paused ? resumeEngine : pauseEngine)}
            className={CHROME_MENU_ITEM}
          >
            {paused ? (
              <Play className="size-4 text-[var(--ink-mid)]" strokeWidth={1.75} aria-hidden="true" />
            ) : (
              <Pause className="size-4 text-[var(--ink-mid)]" strokeWidth={1.75} aria-hidden="true" />
            )}
            <span className={cn(busy === "engine" && "text-[var(--ink-mid)]")}>
              {busy === "engine"
                ? paused
                  ? "Resuming…"
                  : "Pausing…"
                : paused
                  ? "Resume everything"
                  : "Pause everything"}
            </span>
          </button>
          <p className="px-2.5 pb-1.5 pt-0.5 text-[12px] leading-snug text-[var(--ink-dim)]">
            Approvals stay open either way.
          </p>

          {error && (
            <p role="alert" className="px-2.5 py-1.5 text-[13px] leading-snug text-[var(--danger)]">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function GroupSwitch({
  title,
  sub,
  state,
  busy,
  disabled,
  lockedHint,
  onToggle,
}: {
  title: string;
  sub: string;
  state: GroupState;
  busy: boolean;
  disabled: boolean;
  /** set while the engine is paused: the switch is locked and this explains why */
  lockedHint: string | null;
  onToggle: (next: "live" | "paused") => void;
}) {
  const on = state === "live";
  const none = state === "none";
  const labelId = useId();
  const hintId = useId();
  const hint = none ? `${sub} · not set up` : lockedHint ? `${sub} · ${lockedHint}` : sub;
  return (
    <div className="flex min-h-12 items-center gap-3 rounded-[var(--r-btn)] px-2.5 py-1.5">
      <div id={labelId} className="min-w-0 flex-1">
        <p className="text-sm text-[var(--ink)]">{title}</p>
        <p id={hintId} className="truncate text-[12px] text-[var(--ink-dim)]">
          {hint}
        </p>
      </div>
      <button
        type="button"
        role="switch"
        data-engine-control
        aria-checked={on}
        aria-labelledby={labelId}
        aria-describedby={hintId}
        aria-busy={busy || undefined}
        disabled={disabled || none || lockedHint !== null}
        onClick={() => onToggle(on ? "paused" : "live")}
        className={cn(
          "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full disabled:cursor-default disabled:opacity-50",
          on ? "bg-[var(--acc)]" : "bg-[var(--line-strong)]",
          CHROME_MOTION,
          CHROME_FOCUS
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            "size-4 rounded-full bg-[var(--surface)] shadow-[var(--shadow-tile)] transition-transform duration-120 ease-out",
            on ? "translate-x-[18px]" : "translate-x-0.5"
          )}
        />
      </button>
    </div>
  );
}
