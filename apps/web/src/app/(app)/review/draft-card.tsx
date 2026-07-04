"use client";

import { useActionState, useState } from "react";
import { AlertTriangle, MessageSquare, Wand2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { Textarea } from "@/components/ui/textarea";
import { LeadProfileLink, type LeadProfile } from "@/components/lead-profile";
import { approveDraft, declineDraft, declineAndSuppress, fixDraft, saveDraftEdit } from "./actions";
import type { ReviewActionState } from "./actions";

export interface DraftRow {
  id: string;
  channel: "linkedin";
  subject: string | null;
  body: string;
  style_flags: string | null;
  linkedin_stage: "invite" | "message" | null;
  created_at: string;
  leads: LeadProfile | null;
}

/**
 * A single draft's review controls. Two modes:
 * - default: standalone card (Panel) with the lead header + channel badge.
 * - compact: rendered inside a ProspectReviewCard's channel group, so it drops the
 *   repeated lead identity + channel badge (the prospect card + section header carry
 *   those) and shows only the LinkedIn stage label. Keeps body + edit + actions.
 */
export function DraftCard({ draft, compact = false }: { draft: DraftRow; compact?: boolean }) {
  const [editing, setEditing] = useState(false);
  const [approveState, approve, approving] = useActionState<ReviewActionState, FormData>(
    approveDraft,
    {}
  );
  const [declineState, decline, declining] = useActionState<ReviewActionState, FormData>(
    declineDraft,
    {}
  );
  const [suppressState, suppress, suppressing] = useActionState<ReviewActionState, FormData>(
    declineAndSuppress,
    {}
  );
  const [editState, saveEdit, saving] = useActionState<ReviewActionState, FormData>(
    saveDraftEdit,
    {}
  );
  const [fixState, fix, fixing] = useActionState<ReviewActionState, FormData>(fixDraft, {});

  const lead = draft.leads;
  const name = [lead?.first_name, lead?.last_name].filter(Boolean).join(" ") || "Unknown prospect";
  const context = [lead?.title, lead?.company_name].filter(Boolean).join(" · ");
  const error =
    approveState.error ?? declineState.error ?? suppressState.error ?? editState.error ?? fixState.error;
  const stageLabel = draft.linkedin_stage === "invite" ? "Invite" : draft.linkedin_stage === "message" ? "Follow-up" : null;

  // Shared body + actions — identical in both modes.
  const content = (
    <div className="space-y-3">
      {draft.style_flags && (
        <div className="flex items-start justify-between gap-3 rounded-md bg-amber-500/10 px-2.5 py-1.5">
          <p className="flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-400">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
            Style check: {draft.style_flags}
          </p>
          {!editing && (
            <form action={fix} className="shrink-0">
              <input type="hidden" name="sendId" value={draft.id} />
              <Button
                type="submit"
                size="sm"
                variant="outline"
                disabled={fixing}
                data-copilot="fix-draft"
                className="h-6 gap-1 border-amber-500/40 bg-transparent px-2 text-xs text-amber-700 hover:bg-amber-500/15 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-300"
              >
                <Wand2 className="size-3" />
                {fixing ? "Fixing…" : "Fix"}
              </Button>
            </form>
          )}
        </div>
      )}
      {fixState.notice && (
        <p className="text-xs text-amber-700 dark:text-amber-400">{fixState.notice}</p>
      )}

      {editing ? (
        <form
          action={(fd) => {
            saveEdit(fd);
            setEditing(false);
          }}
          className="space-y-2"
        >
          <input type="hidden" name="sendId" value={draft.id} />
          <input type="hidden" name="channel" value={draft.channel} />
          <Textarea name="body" defaultValue={draft.body} rows={6} />
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <div className="rounded-md border border-border bg-muted/30 p-3 text-sm">
          {draft.subject && <p className="mb-1 font-medium">{draft.subject}</p>}
          <p className="whitespace-pre-wrap">{draft.body}</p>
        </div>
      )}

      {!editing && (
        <div className="flex flex-wrap items-center gap-2">
          <form action={approve}>
            <input type="hidden" name="sendId" value={draft.id} />
            <Button type="submit" size="sm" disabled={approving} data-copilot="approve-draft">
              {approving ? "Approving…" : "Approve"}
            </Button>
          </form>
          <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
            Edit
          </Button>
          <form action={decline}>
            <input type="hidden" name="sendId" value={draft.id} />
            <Button type="submit" size="sm" variant="ghost" disabled={declining}>
              Decline
            </Button>
          </form>
          <form action={suppress}>
            <input type="hidden" name="sendId" value={draft.id} />
            <Button
              type="submit"
              size="sm"
              variant="ghost"
              className="text-destructive"
              disabled={suppressing}
            >
              Decline &amp; never contact
            </Button>
          </form>
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );

  // Compact: inside a prospect card's channel group — no Panel, no lead header.
  if (compact) {
    return (
      <div className="rounded-lg border border-border bg-muted/20 p-3.5">
        {stageLabel && (
          <Badge variant="secondary" className="mb-2.5">
            {stageLabel}
          </Badge>
        )}
        {content}
      </div>
    );
  }

  return (
    <Panel className="flex flex-col gap-4">
      <div className="flex flex-row items-start justify-between gap-2">
        <div>
          <LeadProfileLink lead={lead} className="text-left font-medium hover:underline">
            {name}
          </LeadProfileLink>
          {context && <p className="text-sm text-muted-foreground">{context}</p>}
        </div>
        <div className="flex items-center gap-1.5">
          <Badge variant="outline" className="gap-1">
            <MessageSquare className="size-3" />
            LinkedIn
          </Badge>
          {stageLabel && <Badge variant="secondary">{stageLabel}</Badge>}
        </div>
      </div>
      {content}
    </Panel>
  );
}
