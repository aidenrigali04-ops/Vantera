import type { WhatsWorking } from "@/lib/learning/readout";

/**
 * ML-2 "What's working": which kinds of prospects reply more / less than this account's average,
 * learned from its own matured invites. Plain + functional by design (owner restyles later).
 */
export function WhatsWorkingStrip({ working }: { working: WhatsWorking }) {
  const fmt = (r: { label: string; ratio: number }) => `${r.label} ${r.ratio}×`;
  return (
    <div
      className="mb-5 shrink-0 rounded-xl border border-[var(--hairline)] px-4 py-3 text-sm"
      data-copilot="whats-working"
    >
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        What&apos;s working · from {working.evidence} invitations
      </p>
      <div className="mt-1.5 flex flex-wrap gap-x-6 gap-y-1">
        {working.up.length > 0 && (
          <p>
            <span className="text-muted-foreground">Replying more: </span>
            {working.up.map(fmt).join(" · ")}
          </p>
        )}
        {working.down.length > 0 && (
          <p>
            <span className="text-muted-foreground">Replying less: </span>
            {working.down.map(fmt).join(" · ")}
          </p>
        )}
      </div>
      <p className="mt-1.5 text-xs text-muted-foreground">
        Your agent fills each day&apos;s invitations with the prospects most like the ones replying more.
      </p>
    </div>
  );
}
