"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { QueueRow } from "@/lib/today/rows";
import { Avatar, ScoreChip, SignalChip } from "./chips";
import { HIGHLIGHT_KEYS, nextHighlight, rowCommand } from "./keyboard";
import { markFirstRejectSeen, FIRST_REJECT_NOTE, type RejectReason } from "./reject-reasons";
import { RejectReasonPicker, RowActions } from "./row-actions";

/**
 * The queue's row list, shared by Today's work card and the Approvals pane.
 *
 * - `interactive` (Today): the full table — focusable, ↑/↓ highlight, Enter / L / R row
 *   commands, hover Later · Reject · Review, the inline reject-reason picker; a stacked list
 *   under md.
 * - not interactive (Approvals pane): the stacked rows at every width, plain click targets
 *   with the open draft marked. The pane's DraftPeek owns the keyboard there.
 *
 * Empty states belong to the caller.
 */

/* ── shared table shell (also used by the work card's other tables) ───────────── */

export function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <th scope="col" className={cn("h-10 text-left align-middle text-[12px] font-medium text-[var(--ink-dim)]", className)}>
      {children}
    </th>
  );
}

export const ROW_BASE =
  "h-14 border-t border-[color-mix(in_srgb,var(--line)_60%,transparent)] transition-colors first:border-t-0";

export interface QueueListProps {
  rows: QueueRow[];
  /** the draft open in the pane (non-interactive mode marks it) */
  activeId?: string | null;
  onOpen: (id: string) => void;
  interactive: boolean;
  onLater?: (id: string) => void;
  onReject?: (id: string, reason: RejectReason) => Promise<void> | void;
}

export function QueueList({ rows, activeId = null, onOpen, interactive, onLater, onReject }: QueueListProps) {
  if (!interactive) {
    return <StackedRows rows={rows} activeId={activeId} onOpen={onOpen} />;
  }
  return <InteractiveQueue rows={rows} onOpen={onOpen} onLater={onLater ?? noop} onReject={onReject ?? noop} />;
}

function noop() {}

/* ── stacked rows (phones; the Approvals pane at every width) ─────────────────── */

function StackedRows({
  rows,
  activeId,
  onOpen,
  className,
}: {
  rows: QueueRow[];
  activeId: string | null;
  onOpen: (id: string) => void;
  className?: string;
}) {
  return (
    <ul className={className}>
      {rows.map((row) => {
        const active = activeId === row.id;
        return (
          <li key={row.id}>
            <button
              type="button"
              onClick={() => onOpen(row.id)}
              aria-current={active ? "true" : undefined}
              className={cn(
                "flex w-full items-start gap-3 border-t border-[color-mix(in_srgb,var(--line)_60%,transparent)] py-3 text-left first:border-t-0 focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]",
                activeId !== null && "-mx-3 w-[calc(100%+1.5rem)] rounded-[var(--r-btn)] px-3 transition-colors hover:bg-[var(--surface-2)]",
                active && "bg-[var(--acc-tint)] hover:bg-[var(--acc-tint)]"
              )}
            >
              <Avatar initials={row.initials} />
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline gap-2">
                  <span className="min-w-0 flex-1 truncate text-[14px] font-semibold text-[var(--ink)]">{row.name}</span>
                  {row.score !== null ? <ScoreChip score={row.score} /> : null}
                </span>
                <span className="mt-0.5 block truncate text-[13px] text-[var(--ink-dim)]">{row.context}</span>
                <span className="mt-1 block truncate text-[13px] text-[var(--ink-mid)]">
                  {row.signal ? `${row.signal.label} · ${row.signal.age}` : row.signalFallback}
                  {row.signal || row.signalFallback ? " · " : ""}
                  <span className={row.sends.held ? "text-[var(--attention)]" : undefined}>
                    {row.sends.label}
                    {row.sends.sender ? ` · ${row.sends.sender}` : ""}
                  </span>
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/* ── the interactive table (Today) ────────────────────────────────────────────── */

function InteractiveQueue({
  rows,
  onOpen,
  onLater,
  onReject,
}: {
  rows: QueueRow[];
  onOpen: (id: string) => void;
  onLater: (id: string) => void;
  onReject: (id: string, reason: RejectReason) => Promise<void> | void;
}) {
  const [highlight, setHighlight] = useState<number | null>(null);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [collapsing, setCollapsing] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [hint, setHint] = useState<number | null>(null);
  const tableRef = useRef<HTMLTableElement>(null);

  useEffect(() => {
    if (hint === null) return;
    const t = setTimeout(() => setHint(null), 1500);
    return () => clearTimeout(t);
  }, [hint]);
  useEffect(() => {
    if (!note) return;
    const t = setTimeout(() => setNote(null), 5000);
    return () => clearTimeout(t);
  }, [note]);

  const pickReason = useCallback(
    (row: QueueRow, reason: RejectReason) => {
      setRejecting(null);
      setCollapsing(row.id);
      if (markFirstRejectSeen(typeof window === "undefined" ? null : window.localStorage)) setNote(FIRST_REJECT_NOTE);
      // let the row collapse (160ms) before the list drops it
      setTimeout(() => {
        void onReject(row.id, reason);
        setCollapsing(null);
      }, 160);
    },
    [onReject]
  );

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTableElement>) => {
      if (rejecting) return;
      if (HIGHLIGHT_KEYS.has(e.key)) {
        e.preventDefault();
        setHighlight((h) => nextHighlight(h, e.key, rows.length));
        return;
      }
      if (highlight === null) return;
      const row = rows[highlight];
      if (!row) return;
      const cmd = rowCommand(e.key);
      if (!cmd) return;
      e.preventDefault();
      if (cmd === "open") onOpen(row.id);
      else if (cmd === "later") onLater(row.id);
      else if (cmd === "reject") setRejecting(row.id);
      else setHint(highlight);
    },
    [rejecting, rows, highlight, onOpen, onLater]
  );

  return (
    <>
      {/* Under md the card loses its table (blueprint §10): a fixed-width grid cannot fit a
          phone, and a sideways-scrolling page is never the answer. Same data, stacked. */}
      <StackedRows rows={rows} activeId={null} onOpen={onOpen} className="md:hidden" />

      <table
        ref={tableRef}
        tabIndex={0}
        onKeyDown={onKeyDown}
        onBlur={() => setHighlight(null)}
        aria-label="Drafts waiting for approval"
        aria-activedescendant={highlight !== null && rows[highlight] ? `queue-row-${rows[highlight]!.id}` : undefined}
        className="hidden w-full table-fixed border-collapse focus-visible:outline-none md:table"
      >
        <colgroup>
          <col className="w-[336px]" />
          <col className="hidden w-[288px] md:table-column" />
          <col className="w-[80px]" />
          <col className="hidden w-[112px] lg:table-column" />
          <col className="w-[200px]" />
          <col className="w-[136px]" />
        </colgroup>
        <thead>
          <tr>
            <Th>Prospect</Th>
            <Th className="hidden md:table-cell">Signal</Th>
            <Th className="pr-4 text-right">Score</Th>
            <Th className="hidden lg:table-cell">Step</Th>
            <Th>Sends</Th>
            <Th><span className="sr-only">Actions</span></Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const isRejecting = rejecting === row.id;
            const isCollapsing = collapsing === row.id;
            return (
              <tr
                key={row.id}
                id={`queue-row-${row.id}`}
                onClick={() => !isRejecting && onOpen(row.id)}
                onMouseEnter={() => setHighlight(i)}
                className={cn(
                  ROW_BASE,
                  "group cursor-pointer",
                  highlight === i && "bg-[var(--surface-2)]",
                  isCollapsing && "pointer-events-none opacity-0 transition-opacity duration-150"
                )}
              >
                <td className="pr-4 align-middle">
                  <div className="flex items-center gap-3">
                    <Avatar initials={row.initials} />
                    <span className="min-w-0">
                      <span className="block truncate text-[14px] font-semibold text-[var(--ink)]">{row.name}</span>
                      <span className="block truncate text-[13px] text-[var(--ink-dim)]">{row.context}</span>
                    </span>
                  </div>
                </td>
                {isRejecting ? (
                  <td colSpan={4} className="align-middle">
                    <RejectReasonPicker onPick={(r) => pickReason(row, r)} onCancel={() => setRejecting(null)} />
                  </td>
                ) : (
                  <>
                    <td className="hidden pr-4 align-middle md:table-cell">
                      {row.signal ? (
                        <SignalChip signal={row.signal} />
                      ) : row.signalFallback ? (
                        <span className="text-[13px] text-[var(--ink-mid)]">{row.signalFallback}</span>
                      ) : null}
                    </td>
                    <td className="pr-4 text-right align-middle">
                      {row.score !== null ? (
                        <span className="inline-flex justify-end">
                          <ScoreChip score={row.score} title={row.rationale ?? undefined} />
                        </span>
                      ) : (
                        <span className="font-mono text-[12px] text-[var(--ink-dim)]">—</span>
                      )}
                    </td>
                    <td className="hidden pr-4 align-middle lg:table-cell">
                      <span className="font-mono text-[12px] font-medium text-[var(--ink-mid)]">{row.step}</span>
                    </td>
                    <td className="pr-4 align-middle">
                      <span className={cn("text-[13px]", row.sends.held ? "text-[var(--attention)]" : "text-[var(--ink-mid)]")}>
                        {row.sends.label}
                        {row.sends.sender ? ` · ${row.sends.sender}` : ""}
                      </span>
                    </td>
                  </>
                )}
                <td className="align-middle">
                  {isRejecting ? null : hint === i ? (
                    <span className="block text-right text-[12px] text-[var(--ink-dim)]">Open the draft to approve (Enter)</span>
                  ) : (
                    <div className="opacity-0 transition-opacity duration-100 group-hover:opacity-100 group-focus-within:opacity-100">
                      <RowActions
                        onLater={() => onLater(row.id)}
                        onReject={() => setRejecting(row.id)}
                        onReview={() => onOpen(row.id)}
                      />
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {note ? <p className="pb-3 text-[12px] text-[var(--ink-dim)]">{note}</p> : null}
    </>
  );
}
