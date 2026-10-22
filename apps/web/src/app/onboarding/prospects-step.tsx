"use client";

import { useEffect, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { PREVIEW_SHOWN, type RevealStatus } from "@/lib/reveal/status";
import { scoreVerdict, type ScoreTier } from "@/app/(app)/prospects/lead-value";
import { SubmitButton, CtaArrow } from "./onboarding-ui";
import { confirmProspects, rejectPreviewLead } from "./preview-actions";

/** Step heading + line, for the page chrome (STEP_COPY) to render above the step. */
export const PROSPECTS_COPY = {
  title: "First prospects",
  sub: "Your agent found and scored these against your buyers. Remove anyone who isn't a fit — the next match takes their place.",
} as const;

const POLL_MS = 2_000;
const STILL_WORKING_MS = 120_000;
/** LinkedIn's connection-note limit. */
const NOTE_LIMIT = 300;

const NARRATION = {
  not_started: "Reading your site",
  queued: "Reading your site",
  scanning: "Building your buyer profile",
  ranking: "Scoring the first matches",
  drafting: "Writing the first message",
} as const;

type InProgress = keyof typeof NARRATION;
const isInProgress = (s: RevealStatus["status"]): s is InProgress => s in NARRATION;

const CARD = "rounded-xl border border-[rgba(12,16,26,0.1)] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]";
const NOTE = "text-[0.85rem] leading-relaxed text-[var(--ink-3)]";

/**
 * Step 3 · First prospects — the fast pass's result: five scored leads with a reason each,
 * one readable invite note, "Not a fit" per card (the next scored lead fills the slot).
 * Continue never blocks: the run can still be working.
 */
export function ProspectsStep({ status, accountId }: { status: RevealStatus; accountId: string }) {
  // keyed so optimistic removals and the poll clock reset per workspace
  return <ProspectsBody key={accountId} status={status} />;
}

function ProspectsBody({ status }: { status: RevealStatus }) {
  const router = useRouter();
  const working = isInProgress(status.status);
  const [stillWorking, setStillWorking] = useState(false);
  const [removed, setRemoved] = useState<ReadonlySet<string>>(new Set());
  const [rejectError, setRejectError] = useState<string | undefined>();
  const [, startReject] = useTransition();

  useEffect(() => {
    if (!working) return;
    const poll = setInterval(() => router.refresh(), POLL_MS);
    const slow = setTimeout(() => setStillWorking(true), STILL_WORKING_MS);
    return () => {
      clearInterval(poll);
      clearTimeout(slow);
    };
  }, [working, router]);

  const reject = (leadId: string) => {
    setRejectError(undefined);
    setRemoved((prev) => new Set(prev).add(leadId));
    startReject(async () => {
      const res = await rejectPreviewLead(leadId);
      if (res.error) {
        setRejectError(res.error);
        setRemoved((prev) => {
          const next = new Set(prev);
          next.delete(leadId);
          return next;
        });
      } else {
        router.refresh();
      }
    });
  };

  return (
    <div className="flex flex-col gap-6">
      {isInProgress(status.status) || !("matches" in status) ? (
        <Working narration={NARRATION[status.status as InProgress]} stillWorking={stillWorking} />
      ) : (
        <>
          {status.status === "failed" && (
            <p role="status" className={NOTE}>
              We couldn&apos;t finish the first pass. Your agent will retry after you pick a plan.
            </p>
          )}
          {status.matches.length > 0 && (
            <ul className="flex flex-col gap-3">
              {status.matches
                .filter((m) => !removed.has(m.leadId))
                .map((m) => (
                  <li key={m.leadId} className={cn(CARD, "p-4")}>
                    <ProspectCard match={m} onReject={() => reject(m.leadId)} />
                    {status.topDraft?.leadId === m.leadId && <InviteNote body={status.topDraft.body} />}
                  </li>
                ))}
            </ul>
          )}
          {rejectError && (
            <p role="alert" className="text-[0.85rem] text-destructive">
              {rejectError}
            </p>
          )}
          {status.status === "done" && status.poolRemaining === 0 && (
            <p className={NOTE}>
              That&apos;s everyone from the first pass — your agent keeps looking after you pick a plan.
            </p>
          )}
        </>
      )}

      <form action={confirmProspects}>
        <ContinueButton />
      </form>
    </div>
  );
}

function Working({ narration, stillWorking }: { narration: string; stillWorking: boolean }) {
  return (
    <div className="flex flex-col gap-4" aria-busy="true">
      <p role="status" className="flex items-center gap-2 text-[0.9rem] font-medium text-foreground">
        <span className="size-1.5 animate-pulse rounded-full bg-[var(--fb)] motion-reduce:animate-none" aria-hidden />
        {narration}…
      </p>
      <ul className="flex flex-col gap-3" aria-hidden>
        {Array.from({ length: PREVIEW_SHOWN }, (_, i) => (
          <li key={i} className={cn(CARD, "flex flex-col gap-2.5 p-4")}>
            <div className="h-3.5 w-2/5 animate-pulse rounded bg-[var(--tint)] motion-reduce:animate-none" />
            <div className="h-3 w-3/5 animate-pulse rounded bg-[var(--tint)] motion-reduce:animate-none" />
            <div className="h-3 w-4/5 animate-pulse rounded bg-[var(--tint)] motion-reduce:animate-none" />
          </li>
        ))}
      </ul>
      {stillWorking && (
        <p className={NOTE}>Still working — you can keep going, your prospects will be on Today.</p>
      )}
    </div>
  );
}

type Match = Extract<RevealStatus, { matches: unknown }>["matches"][number];

function ProspectCard({ match, onReject }: { match: Match; onReject: () => void }) {
  const { tier, label } = scoreVerdict(match.score);
  const role = [match.title, match.company].filter(Boolean).join(" · ");
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="truncate text-[0.95rem] font-semibold text-foreground">{match.name}</p>
        {role && <p className="truncate text-[0.85rem] text-[var(--ink-3)]">{role}</p>}
        <p className="mt-1.5 flex items-center gap-2 text-[0.8rem] text-[var(--ink-2)]">
          <TierGlyph tier={tier} />
          <span>{label}</span>
          <span className="font-mono tabular-nums text-[var(--ink-3)]">{match.score}</span>
        </p>
        {match.evidenceLine && <p className={cn(NOTE, "mt-2")}>{match.evidenceLine}</p>}
      </div>
      <button
        type="button"
        onClick={onReject}
        className="h-8 shrink-0 rounded-lg border border-[rgba(12,16,26,0.1)] bg-white px-3 text-[0.8rem] font-medium text-[var(--ink-2)] transition-colors hover:border-[rgba(12,16,26,0.16)] hover:bg-[var(--tint)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--fb-tint)]"
      >
        Not a fit
      </button>
    </div>
  );
}

const TIER_BARS: Record<ScoreTier, number> = { hot: 3, strong: 2, look: 1, unscored: 0 };

/** Three ascending bars, filled by tier (hot 3 · strong 2 · look 1). */
function TierGlyph({ tier }: { tier: ScoreTier }) {
  const filled = TIER_BARS[tier];
  return (
    <span aria-hidden className="inline-flex h-3 items-end gap-0.5">
      {[1, 2, 3].map((n) => (
        <span
          key={n}
          className={cn("w-1 rounded-sm", n <= filled ? "bg-[var(--fb)]" : "bg-[rgba(12,16,26,0.12)]")}
          style={{ height: `${n * 4}px` }}
        />
      ))}
    </span>
  );
}

/** The one readable draft, shown as the LinkedIn connection note it would be. */
function InviteNote({ body }: { body: string }) {
  const over = body.length > NOTE_LIMIT;
  return (
    <div className="mt-4 rounded-lg border border-[rgba(12,16,26,0.07)] bg-[var(--tint)] p-3.5">
      <p className="mb-1.5 text-[0.6875rem] font-medium uppercase tracking-wide text-[var(--ink-4)]">
        LinkedIn invite note
      </p>
      <p className="whitespace-pre-line text-[0.875rem] leading-relaxed text-foreground">{body}</p>
      {over && (
        <p className="mt-1.5 text-right font-mono text-[0.75rem] tabular-nums text-[var(--attention,#9a6a00)]">
          {body.length}/{NOTE_LIMIT}
        </p>
      )}
    </div>
  );
}

function ContinueButton() {
  const { pending } = useFormStatus();
  return (
    <SubmitButton
      pending={pending}
      idle={
        <>
          Continue <CtaArrow />
        </>
      }
      busy="Saving…"
    />
  );
}
