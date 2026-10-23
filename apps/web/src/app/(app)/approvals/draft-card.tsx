"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, MessageSquare, PenLine } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Panel } from "@/components/ui/panel";
import { Textarea } from "@/components/ui/textarea";
import { LeadProfileLink, type LeadProfile } from "@/components/lead-profile";
import { trackFirstDraftApproved } from "@/lib/analytics/activation";
import { approveDraft, declineAndSuppress, fixDraft, saveDraftEdit } from "./actions";
import type { ReviewActionState } from "./actions";
import { rejectDraftWithReason, undoRejectDraft } from "../today/actions";
import { REJECT_REASONS, REJECT_REASON_ORDER, type RejectReason } from "@/components/today/work-card/reject-reasons";

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

type BusyKey = "approve" | "decline" | "suppress" | "save" | "fix";

/**
 * A single draft's review controls. Two modes:
 * - default: standalone card (Panel) with the lead header + channel badge.
 * - compact: rendered inside a ProspectReviewCard's channel group, so it drops the
 *   repeated lead identity + channel badge (the prospect card + section header carry
 *   those) and shows only the LinkedIn stage label. Keeps body + edit + actions.
 *
 * R1b: every action toasts its outcome — the card vanishing on revalidate is no longer
 * the only success signal, and errors surface both inline and as a toast.
 */
export function DraftCard({ draft, compact = false }: { draft: DraftRow; compact?: boolean }) {
  const [editing, setEditing] = useState(false);
  // Decline asks why (the same closed set as Today) — rejections teach the engine.
  const [choosingReason, setChoosingReason] = useState(false);
  const suppressFormRef = useRef<HTMLFormElement>(null);
  const [busy, setBusy] = useState<BusyKey | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const run = (
    key: BusyKey,
    action: (prev: ReviewActionState, fd: FormData) => Promise<ReviewActionState>,
    fd: FormData,
    success: string
  ) => {
    setBusy(key);
    setError(null);
    setNotice(null);
    void action({}, fd)
      .then((res) => {
        if (res.error) {
          setError(res.error);
          toast.error(res.error);
        } else {
          if (key === "approve") trackFirstDraftApproved();
          if (res.notice) setNotice(res.notice);
          toast.success(res.notice ?? success);
        }
      })
      .finally(() => setBusy(null));
  };

  const decline = (reason: RejectReason) => {
    setBusy("decline");
    setError(null);
    void rejectDraftWithReason(draft.id, reason)
      .then((res) => {
        if (res.error) {
          setError(res.error);
          toast.error(res.error);
          return;
        }
        setChoosingReason(false);
        toast.success("Declined — it won't send.", {
          action: {
            label: "Undo",
            onClick: () => {
              void undoRejectDraft(draft.id).then((u) => {
                if (u.error) toast.error(u.error);
              });
            },
          },
        });
      })
      .finally(() => setBusy(null));
  };

  const lead = draft.leads;
  const name = [lead?.first_name, lead?.last_name].filter(Boolean).join(" ") || "Unknown prospect";
  const context = [lead?.title, lead?.company_name].filter(Boolean).join(" · ");
  const stageLabel = draft.linkedin_stage === "invite" ? "Invite" : draft.linkedin_stage === "message" ? "Follow-up" : null;

  // Shared body + actions — identical in both modes.
  const content = (
    <div className="space-y-3">
      {draft.style_flags && (
        <div className="flex items-start justify-between gap-3 rounded-[var(--r-btn)] bg-[var(--attention-tint)] px-3 py-2">
          <p className="flex items-start gap-1.5 text-xs font-medium text-[var(--attention)]">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
            Style check: {draft.style_flags}
          </p>
          {!editing && (
            <form
              action={(fd) => run("fix", fixDraft, fd, "Fix pass done.")}
              className="shrink-0"
            >
              <input type="hidden" name="sendId" value={draft.id} />
              <Button
                type="submit"
                size="sm"
                variant="outline"
                disabled={busy !== null}
                data-copilot="fix-draft"
                className="h-6 gap-1 border-[var(--attention)]/30 bg-transparent px-2 text-xs text-[var(--attention)] hover:bg-[var(--attention-tint)] hover:text-[var(--attention)]"
              >
                <PenLine className="size-3" />
                {busy === "fix" ? "Fixing…" : "Fix"}
              </Button>
            </form>
          )}
        </div>
      )}
      {notice && <p className="text-xs font-medium text-[var(--attention)]">{notice}</p>}

      {editing ? (
        <form
          action={(fd) => {
            run("save", saveDraftEdit, fd, "Draft updated.");
            setEditing(false);
          }}
          className="space-y-2"
        >
          <input type="hidden" name="sendId" value={draft.id} />
          <input type="hidden" name="channel" value={draft.channel} />
          <Textarea name="body" defaultValue={draft.body} rows={6} />
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={busy === "save"}>
              {busy === "save" ? "Saving…" : "Save"}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <div className="rounded-[14px] rounded-br-[4px] bg-[#eef4fe] px-4 py-3 text-[13.5px] leading-relaxed text-[var(--ink-2)]">
          {draft.subject && <p className="mb-1 font-medium">{draft.subject}</p>}
          <p className="whitespace-pre-wrap">{draft.body}</p>
        </div>
      )}

      {!editing && (
        <div className="flex flex-wrap items-center gap-2">
          <form action={(fd) => run("approve", approveDraft, fd, "Approved — queued to send.")}>
            <input type="hidden" name="sendId" value={draft.id} />
            <Button type="submit" size="sm" disabled={busy !== null} data-copilot="approve-draft">
              {busy === "approve" ? "Approving…" : "Approve"}
            </Button>
          </form>
          <Button size="sm" variant="outline" onClick={() => setEditing(true)} data-hotkey="edit-draft">
            Edit
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={busy !== null}
            data-hotkey="decline-draft"
            aria-expanded={choosingReason}
            onClick={() => setChoosingReason((v) => !v)}
          >
            {busy === "decline" ? "Declining…" : "Decline"}
          </Button>
          <form
            ref={suppressFormRef}
            action={(fd) =>
              run("suppress", declineAndSuppress, fd, "Declined — this prospect will never be contacted.")
            }
          >
            <input type="hidden" name="sendId" value={draft.id} />
            {/* R2: suppression is permanent (rule 11 — entries never expire), so it confirms. */}
            <ConfirmDialog
              title="Never contact this prospect?"
              description="This declines the draft and adds the prospect to your suppression list permanently — no agent or teammate can ever message them again. This cannot be undone."
              confirmLabel="Never contact"
              destructive
              onConfirm={() => suppressFormRef.current?.requestSubmit()}
              trigger={(open) => (
                <Button
                  type="button"
                  onClick={open}
                  size="sm"
                  variant="ghost"
                  className="text-destructive"
                  disabled={busy !== null}
                >
                  Decline &amp; never contact
                </Button>
              )}
            />
          </form>
        </div>
      )}

      {choosingReason && !editing && (
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Why decline this draft?">
          <span className="mr-1 text-xs text-[var(--ink-dim)]">Why?</span>
          {REJECT_REASON_ORDER.map((reason) => (
            <Button
              key={reason}
              type="button"
              size="sm"
              variant="outline"
              disabled={busy !== null}
              className="h-7 px-2.5 text-xs"
              onClick={() => decline(reason)}
            >
              {REJECT_REASONS[reason]}
            </Button>
          ))}
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
