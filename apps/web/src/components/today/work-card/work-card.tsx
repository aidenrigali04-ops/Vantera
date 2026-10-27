"use client";

import Link from "next/link";
import { Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ActivityRow, QueueRow, ReplyRow, TodayView } from "@/lib/today/rows";
import { EmptyLine, TextLink } from "@/components/today";
import { ActorChip, Avatar, ClassChip } from "./chips";
import { CardTabs, type CardTab } from "./card-tabs";
import { EngineLineView } from "./engine-line-view";
import { MonoText } from "./mono-text";
import { QueueList, ROW_BASE, Th } from "./queue-list";
import type { RejectReason } from "./reject-reasons";
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
            <TextLink href={view.queue.rows[0] ? `/approvals?draft=${view.queue.rows[0].id}` : "/approvals"}>Open queue ({view.queue.total}) →</TextLink>
          ) : tab === "replies" && view.replies.total > 0 ? (
            <TextLink href="/inbox?filter=waiting">Open inbox ({view.replies.total}) →</TextLink>
          ) : null}
        </div>
      </div>
    </section>
  );
}

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

  return <QueueList rows={rows} onOpen={onOpenDraft} interactive onLater={onLater} onReject={onReject} />;
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
                  <span className="min-w-0 flex-1 truncate text-[14px] font-semibold text-[var(--ink)]">{row.name}</span>
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
                  <span className="block truncate text-[14px] font-semibold text-[var(--ink)]">{row.name}</span>
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
                className="ml-auto hidden size-8 place-items-center rounded-[var(--r-btn)] bg-[var(--acc)] text-white transition-colors hover:bg-[var(--acc-ink)] group-hover:grid focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]"
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
