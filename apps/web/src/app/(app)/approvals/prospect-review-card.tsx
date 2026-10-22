"use client";

import { useState } from "react";
import { ChevronRight, MessageSquare } from "lucide-react";
import { Panel } from "@/components/ui/panel";
import { Avatar } from "@/components/today/work-card/chips";
import { initials } from "@/lib/today/metrics";
import { LeadProfileLink, type LeadProfile } from "@/components/lead-profile";
import { ScoreBadge, SourceBadge, WhyNowLine } from "@/components/lead-why-now";
import { DraftCard, type DraftRow } from "./draft-card";

export interface ProspectGroup {
  lead: LeadProfile | null;
  drafts: DraftRow[];
}

// Invite before follow-up within the LinkedIn group.
const STAGE_ORDER: Record<string, number> = { invite: 0, message: 1 };
const byStage = (a: DraftRow, b: DraftRow) =>
  (STAGE_ORDER[a.linkedin_stage ?? "message"] ?? 1) - (STAGE_ORDER[b.linkedin_stage ?? "message"] ?? 1);

/**
 * One collapsible row per PROSPECT. Collapsed: identity + fit score + a draft
 * count — the whole queue reads as a short, clearable list (B=MAP). Expanded:
 * the prospect's LinkedIn drafts (invite then follow-ups), each with its own
 * approve / edit / decline controls.
 */
export function ProspectReviewCard({
  group,
  defaultOpen = false,
}: {
  group: ProspectGroup;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const { lead, drafts } = group;

  const name = [lead?.first_name, lead?.last_name].filter(Boolean).join(" ") || "Unknown prospect";
  const context = [lead?.title, lead?.company_name].filter(Boolean).join(" · ");
  const score = typeof lead?.ai_score === "number" ? lead.ai_score : null;

  const linkedin = [...drafts].sort(byStage);

  return (
    <Panel className="overflow-hidden p-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-[#f5f9ff]"
      >
        <ChevronRight
          className={`size-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-90" : ""}`}
        />
        <Avatar initials={initials(name)} size={40} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate text-[14px] font-semibold text-[var(--ink)]">{name}</span>
            <SourceBadge source={lead?.source} />
            {score !== null && <ScoreBadge score={score} withVerdict />}
          </div>
          {context && <p className="truncate text-[13px] text-[var(--ink-dim)]">{context}</p>}
          {/* The "because" behind the draft — approve without expanding, informed. */}
          {lead && <WhyNowLine lead={lead} />}
        </div>
        <div className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
          {linkedin.length > 0 && (
            <span className="inline-flex items-center gap-1" title="LinkedIn drafts">
              <MessageSquare className="size-3.5" />
              {linkedin.length}
            </span>
          )}
          <span className="rounded-full bg-[var(--acc-tint)] px-2 py-0.5 font-semibold tabular-nums text-[var(--acc-ink)]">
            {drafts.length} draft{drafts.length === 1 ? "" : "s"}
          </span>
        </div>
      </button>

      {open && (
        <div className="space-y-5 border-t border-[var(--line)] bg-[#fbfcfd] px-4 py-4">
          {lead && (
            <LeadProfileLink
              lead={lead}
              className="text-left text-xs font-medium text-muted-foreground underline-offset-2 hover:underline"
            >
              View full prospect profile →
            </LeadProfileLink>
          )}

          {linkedin.length > 0 && (
            <section className="space-y-3">
              <h3 className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <MessageSquare className="size-3.5" /> LinkedIn
              </h3>
              {linkedin.map((d) => (
                <DraftCard key={d.id} draft={d} compact />
              ))}
            </section>
          )}
        </div>
      )}
    </Panel>
  );
}
