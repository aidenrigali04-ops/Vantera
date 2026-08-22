"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ActivityRow, QueueRow, ReplyRow, TodayView } from "@/lib/today/rows";
import { EmptyLine, TextLink } from "@/components/today";
import { ActorChip, Avatar, ClassChip, ScoreChip, SignalChip } from "./chips";
import { CardTabs, type CardTab } from "./card-tabs";
import { EngineLineView } from "./engine-line-view";
import { HIGHLIGHT_KEYS, nextHighlight, rowCommand } from "./keyboard";
import { MonoText } from "./mono-text";
import { markFirstRejectSeen, FIRST_REJECT_NOTE, type RejectReason } from "./reject-reasons";
import { RejectReasonPicker, RowActions } from "./row-actions";
import { SenderChip } from "./sender-chip";

/**
 * Z5 · the work card (blueprint §6.7–§6.11): one white card, three tabs, and the Engine
 * line. It answers "what exactly is waiting" without leaving the page — rows show the
 * opening line, the peek shows the draft, and Approve lives only in the peek (D7).
 *
 * The card height is fixed across tabs (header + 5 rows + footer), so switching tabs never
 * jumps the page.
 */

const ROW_H = 56;
const HEAD_H = 40;
const BODY_MIN = HEAD_H + ROW_H * 5;

export interface WorkCardProps {
  view: Pick<TodayView, "queue" | "replies" | "activity" | "senders" | "engine" | "updatedLabel" | "defaultTab" | "nextRunLabel" | "paused">;
  tab: CardTab;
  onOpenDraft: (id: string) => void;
  onLater: (id: string) => void;
  onReject: (id: string, reason: RejectReason) => Promise<void> | void;
  onResume?: () => void;
}

export function WorkCard({ view, tab, onOpenDraft, onLater, onReject, onResume }: WorkCardProps) {
  const tabs = [
    { key: "queue" as const, label: "Queue", count: view.queue.total },
    { key: "replies" as const, label: "Replies", count: view.replies.total },
    { key: "activity" as const, label: "Activity", count: null },
  ];

  return (
    <section className="mt-12 rounded-[var(--r-card)] bg-[var(--surface)] ring-1 ring-[var(--line)] shadow-[var(--shadow-card)]">
      {/* header */}
      <div className="flex h-16 items-center justify-between gap-4 border-b border-[var(--line)] px-6">
        <CardTabs tabs={tabs} active={tab} />
        <div className="flex min-w-0 items-center gap-2">
          <span className="hidden shrink-0 text-[13px] text-[var(--ink-dim)] lg:inline">Senders</span>
          {/* The chips are the widest thing in the header; on a phone they push the card past
              the viewport. The Engine line in the footer already names every sender and its
              state, and the gear still reaches the full readout. */}
          <div className="hidden min-w-0 items-center gap-1.5 overflow-x-auto md:flex">
            {view.senders.map((s) => (
              <SenderChip key={s.id} sender={s} />
            ))}
          </div>
          <Link
            href="/settings/senders"
            aria-label="Sender settings"
            title="Sender settings"
            className="grid size-8 shrink-0 place-items-center rounded-[var(--r-btn)] text-[var(--ink-mid)] ring-1 ring-[var(--line)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--ink)] focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]"
          >
            <Settings size={16} strokeWidth={1.75} aria-hidden="true" />
          </Link>
        </div>
      </div>

      {/* body */}
      <div className="px-6" style={{ minHeight: BODY_MIN }}>
        {tab === "queue" ? (
          <QueueTable
            rows={view.queue.rows}
            approvedToday={view.queue.approvedToday}
            nextRunLabel={view.nextRunLabel}
            repliesWaiting={view.replies.total}
            onOpenDraft={onOpenDraft}
            onLater={onLater}
            onReject={onReject}
          />
        ) : tab === "replies" ? (
          <RepliesTable rows={view.replies.rows} answeredThisWeek={view.replies.answeredThisWeek} />
        ) : (
          <ActivityTable rows={view.activity.rows} startedAgo={view.activity.engineStartedAgo} />
        )}
      </div>

      {/* footer */}
      <div className="flex min-h-12 flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-[var(--line)] px-6 py-2">
        <EngineLineView line={view.engine} onResume={onResume} />
        <div className="flex shrink-0 items-center gap-3">
          <span className="text-[13px] text-[var(--ink-dim)]">
            Updated <span className="font-mono">{view.updatedLabel}</span>
          </span>
          {tab === "queue" && view.queue.total > 0 ? (
            <TextLink href="/approvals">Open queue ({view.queue.total}) →</TextLink>
          ) : tab === "replies" && view.replies.total > 0 ? (
            <TextLink href="/inbox?filter=waiting">Open inbox ({view.replies.total}) →</TextLink>
          ) : null}
        </div>
      </div>
    </section>
  );
}

/* ── shared table shell ─────────────────────────────────────────────────────── */

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <th scope="col" className={cn("h-10 text-left align-middle text-[12px] font-medium text-[var(--ink-dim)]", className)}>
      {children}
    </th>
  );
}

const ROW_BASE =
  "h-14 border-t border-[color-mix(in_srgb,var(--line)_60%,transparent)] transition-colors first:border-t-0";

/* ── Queue ──────────────────────────────────────────────────────────────────── */

function QueueTable({
  rows,
  approvedToday,
  nextRunLabel,
  repliesWaiting,
  onOpenDraft,
  onLater,
  onReject,
}: {
  rows: QueueRow[];
  approvedToday: number;
  nextRunLabel: string | null;
  repliesWaiting: number;
  onOpenDraft: (id: string) => void;
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
      if (cmd === "open") onOpenDraft(row.id);
      else if (cmd === "later") onLater(row.id);
      else if (cmd === "reject") setRejecting(row.id);
      else setHint(highlight);
    },
    [rejecting, rows, highlight, onOpenDraft, onLater]
  );

  if (rows.length === 0) {
    return (
      <div className="flex min-h-[inherit] items-center py-6">
        <EmptyLine>
          <MonoText
            text={
              approvedToday > 0
                ? `Queue clear — ‹${approvedToday}› approved today.${nextRunLabel ? ` Next drafts ~‹${nextRunLabel}›.` : ""}`
                : `Queue clear.${nextRunLabel ? ` Next drafts ~‹${nextRunLabel}›.` : ""}`
            }
          />
          {repliesWaiting > 0 ? (
            <>
              {" "}
              <TextLink href="/inbox?filter=waiting">Open inbox ({repliesWaiting}) →</TextLink>
            </>
          ) : null}
        </EmptyLine>
      </div>
    );
  }

  return (
    <>
      {/* Under md the card loses its table (blueprint §10): a fixed-width grid cannot fit a
          phone, and a sideways-scrolling page is never the answer. Same data, stacked. */}
      <ul className="md:hidden">
        {rows.map((row) => (
          <li key={row.id}>
            <button
              type="button"
              onClick={() => onOpenDraft(row.id)}
              className="flex w-full items-start gap-3 border-t border-[color-mix(in_srgb,var(--line)_60%,transparent)] py-3 text-left first:border-t-0 focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]"
            >
              <Avatar initials={row.initials} />
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline gap-2">
                  <span className="min-w-0 flex-1 truncate text-[14px] font-medium text-[var(--ink)]">{row.name}</span>
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
        ))}
      </ul>

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
                onClick={() => !isRejecting && onOpenDraft(row.id)}
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
                      <span className="block truncate text-[14px] font-medium text-[var(--ink)]">{row.name}</span>
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
                        onReview={() => onOpenDraft(row.id)}
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

/* ── Replies ────────────────────────────────────────────────────────────────── */

function RepliesTable({ rows, answeredThisWeek }: { rows: ReplyRow[]; answeredThisWeek: number }) {
  if (rows.length === 0) {
    return (
      <div className="flex min-h-[inherit] items-center py-6">
        <EmptyLine>
          <MonoText text={`No replies waiting. ‹${answeredThisWeek}› replies this week are all answered.`} />
        </EmptyLine>
      </div>
    );
  }
  return (
    <>
      <ul className="md:hidden">
        {rows.map((row) => (
          <li key={row.id}>
            <Link
              href={`/inbox?lead=${row.leadId}`}
              className="flex items-start gap-3 border-t border-[color-mix(in_srgb,var(--line)_60%,transparent)] py-3 first:border-t-0 focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]"
            >
              <Avatar initials={row.initials} />
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline gap-2">
                  <span className="min-w-0 flex-1 truncate text-[14px] font-medium text-[var(--ink)]">{row.name}</span>
                  <span className="shrink-0 font-mono text-[12px] text-[var(--ink-dim)]">{row.received}</span>
                </span>
                <span className="mt-0.5 block truncate text-[13px] text-[var(--ink)]">{row.excerpt}</span>
                <span className="mt-1 flex items-center gap-2">
                  <ClassChip klass={row.klass} />
                  {row.note ? (
                    <span className={cn("min-w-0 truncate text-[12px]", row.noteIsDraft ? "text-[var(--acc-ink)]" : "text-[var(--ink-dim)]")}>
                      {row.note}
                    </span>
                  ) : null}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <table className="hidden w-full table-fixed border-collapse md:table" aria-label="Replies waiting on you">
      <colgroup>
        <col className="w-[336px]" />
        <col />
        <col className="w-[120px]" />
        <col className="w-[136px]" />
      </colgroup>
      <thead>
        <tr>
          <Th>Prospect</Th>
          <Th>Reply</Th>
          <Th className="hidden md:table-cell">Class</Th>
          <Th className="text-right">Received</Th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id} className={cn(ROW_BASE, "group hover:bg-[var(--surface-2)]")}>
            <td className="pr-4 align-middle">
              <Link href={`/inbox?lead=${row.leadId}`} className="flex items-center gap-3 focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]">
                <Avatar initials={row.initials} />
                <span className="min-w-0">
                  <span className="block truncate text-[14px] font-medium text-[var(--ink)]">{row.name}</span>
                  {row.company ? <span className="block truncate text-[13px] text-[var(--ink-dim)]">{row.company}</span> : null}
                </span>
              </Link>
            </td>
            <td className="pr-4 align-middle">
              <Link href={`/inbox?lead=${row.leadId}`} className="block min-w-0 focus-visible:outline-none">
                <span className="block truncate text-[14px] text-[var(--ink)]">{row.excerpt}</span>
                {row.note ? (
                  <span className={cn("block truncate text-[13px]", row.noteIsDraft ? "text-[var(--acc-ink)]" : "text-[var(--ink-dim)]")}>
                    {row.note}
                  </span>
                ) : null}
              </Link>
            </td>
            <td className="hidden pr-4 align-middle md:table-cell">
              <ClassChip klass={row.klass} />
            </td>
            <td className="text-right align-middle">
              <span className="font-mono text-[12px] text-[var(--ink-dim)] group-hover:hidden">{row.received}</span>
              <Link
                href={`/inbox?lead=${row.leadId}`}
                aria-label={`Open thread with ${row.name}`}
                className="ml-auto hidden size-8 place-items-center rounded-[var(--r-btn)] bg-[var(--ink)] text-[var(--ink-fg)] transition-colors hover:bg-[#1f1f23] group-hover:grid focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]"
              >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
                  <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
            </td>
          </tr>
        ))}
      </tbody>
      </table>
    </>
  );
}

/* ── Activity ───────────────────────────────────────────────────────────────── */

function ActivityTable({ rows, startedAgo }: { rows: ActivityRow[]; startedAgo: string | null }) {
  if (rows.length === 0) {
    return (
      <div className="flex min-h-[inherit] items-center py-6">
        <EmptyLine>
          {startedAgo ? (
            <MonoText text={`The engine started ‹${startedAgo}› ago. Sourcing shows up here first, then scoring, then drafts.`} />
          ) : (
            "Nothing yet today."
          )}
        </EmptyLine>
      </div>
    );
  }
  return (
    <table className="w-full table-fixed border-collapse" aria-label="What the engine did">
      <colgroup>
        <col className="w-[96px]" />
        <col />
        <col className="w-[160px]" />
      </colgroup>
      <thead>
        <tr>
          <Th>Time</Th>
          <Th>Event</Th>
          <Th className="hidden md:table-cell">By</Th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id} className={ROW_BASE}>
            <td className="pr-4 align-middle">
              <span className="font-mono text-[12px] text-[var(--ink-dim)]">{row.time}</span>
            </td>
            <td className="pr-4 align-middle">
              <span className="block text-[14px] text-[var(--ink)]">
                {row.parts.map((part, i) =>
                  part.href ? (
                    <Link key={i} href={part.href} className="font-medium text-[var(--acc)] hover:underline">
                      {part.text}
                    </Link>
                  ) : (
                    <span key={i} className={cn(part.strong && "font-medium", part.mono && "font-mono tabular-nums")}>
                      {part.text}
                    </span>
                  )
                )}
              </span>
            </td>
            <td className="hidden align-middle md:table-cell">
              <ActorChip>{row.actor}</ActorChip>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
