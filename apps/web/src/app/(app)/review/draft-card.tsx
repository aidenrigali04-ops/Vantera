"use client";

import { useActionState, useState } from "react";
import { AlertTriangle, Mail, MessageSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { LeadProfileLink, type LeadProfile } from "@/components/lead-profile";
import { approveDraft, declineDraft, declineAndSuppress, saveDraftEdit } from "./actions";
import type { ReviewActionState } from "./actions";

export interface DraftRow {
  id: string;
  channel: "email" | "linkedin";
  subject: string | null;
  body: string;
  style_flags: string | null;
  linkedin_stage: "invite" | "message" | null;
  created_at: string;
  leads: LeadProfile | null;
}

export function DraftCard({ draft }: { draft: DraftRow }) {
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

  const lead = draft.leads;
  const name = [lead?.first_name, lead?.last_name].filter(Boolean).join(" ") || "Unknown prospect";
  const context = [lead?.title, lead?.company_name].filter(Boolean).join(" · ");
  const error = approveState.error ?? declineState.error ?? suppressState.error ?? editState.error;

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between space-y-0">
        <div>
          <LeadProfileLink lead={lead} className="text-left font-medium hover:underline">
            {name}
          </LeadProfileLink>
          {context && <p className="text-sm text-muted-foreground">{context}</p>}
        </div>
        <div className="flex items-center gap-1.5">
          <Badge variant="outline" className="gap-1">
            {draft.channel === "email" ? <Mail className="size-3" /> : <MessageSquare className="size-3" />}
            {draft.channel === "email" ? "Email" : "LinkedIn"}
          </Badge>
          {draft.linkedin_stage && (
            <Badge variant="secondary">
              {draft.linkedin_stage === "invite" ? "Invite" : "Follow-up"}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {draft.style_flags && (
          <p className="flex items-start gap-1.5 rounded-md bg-amber-500/10 px-2.5 py-1.5 text-xs text-amber-700 dark:text-amber-400">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
            Style check: {draft.style_flags}
          </p>
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
            {draft.channel === "email" && (
              <Input name="subject" defaultValue={draft.subject ?? ""} placeholder="Subject" />
            )}
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
      </CardContent>
    </Card>
  );
}
