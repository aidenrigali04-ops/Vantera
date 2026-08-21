"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateLeadDetails } from "./edit-actions";

/**
 * R6: the lead's identity block with inline correction. Display mode is the h1 the page
 * always had; edit mode swaps in a compact form. Saved values feed the next draft directly
 * (same columns the copy pipeline grounds on).
 */
export function LeadIdentity({
  leadId,
  firstName,
  lastName,
  title,
  companyName,
}: {
  leadId: string;
  firstName: string | null;
  lastName: string | null;
  title: string | null;
  companyName: string | null;
}) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);

  const name = [firstName, lastName].filter(Boolean).join(" ") || "Unknown prospect";
  const subline = [title, companyName].filter(Boolean).join(" · ") || "—";

  if (!editing) {
    return (
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{name}</h1>
          <button
            type="button"
            onClick={() => setEditing(true)}
            aria-label="Edit lead details"
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-[var(--tint)] hover:text-foreground"
          >
            <Pencil className="size-3.5" />
          </button>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{subline}</p>
      </div>
    );
  }

  const submit = (fd: FormData) => {
    setBusy(true);
    updateLeadDetails(fd)
      .then((res) => {
        if (res.error) {
          toast.error(res.error);
          return;
        }
        toast.success("Lead updated — the corrected details ground the next draft.");
        setEditing(false);
      })
      .finally(() => setBusy(false));
  };

  return (
    <form action={submit} className="min-w-0 max-w-xl">
      <input type="hidden" name="leadId" value={leadId} />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="edit-first">First name</Label>
          <Input id="edit-first" name="firstName" defaultValue={firstName ?? ""} required maxLength={120} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="edit-last">Last name</Label>
          <Input id="edit-last" name="lastName" defaultValue={lastName ?? ""} maxLength={120} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="edit-title">Title</Label>
          <Input id="edit-title" name="title" defaultValue={title ?? ""} maxLength={120} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="edit-company">Company</Label>
          <Input id="edit-company" name="companyName" defaultValue={companyName ?? ""} maxLength={120} />
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <Button type="submit" size="sm" disabled={busy}>
          {busy ? "Saving…" : "Save"}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)} disabled={busy}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
