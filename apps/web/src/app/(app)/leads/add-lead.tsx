"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addManualLead } from "./add-lead-action";

/**
 * R6: "Add lead" — the user brings their own prospect. The dialog collects identity only;
 * qualification runs the same gate + rank as discovery (the action states this honestly).
 * Portal to <body>, Esc/overlay close — the R2 dialog idiom.
 */
export function AddLead() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const close = useCallback(() => {
    if (!busy) setOpen(false);
  }, [busy]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  const submit = (fd: FormData) => {
    setBusy(true);
    addManualLead(fd)
      .then((res) => {
        if (res.error) {
          toast.error(res.error);
          return;
        }
        toast.success("Lead added — Vera is researching and scoring them now.");
        formRef.current?.reset();
        setOpen(false);
      })
      .finally(() => setBusy(false));
  };

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus className="size-4" /> Add lead
      </Button>
      {open &&
        createPortal(
          <div className="fixed inset-0 z-[70] grid place-items-center bg-black/30 p-4" onClick={close}>
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="add-lead-title"
              className="w-full max-w-md rounded-xl border border-[var(--hairline)] bg-white p-5 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 id="add-lead-title" className="font-heading text-base font-semibold">
                    Add a lead
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Vera researches and scores them against your ICP — the same bar every
                    prospect passes before outreach.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={close}
                  aria-label="Close"
                  className="rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
                >
                  <X className="size-4" />
                </button>
              </div>

              <form ref={formRef} action={submit} className="mt-4 flex flex-col gap-3.5">
                <div className="grid gap-3.5 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="add-first">First name</Label>
                    <Input id="add-first" name="firstName" required maxLength={120} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="add-last">Last name</Label>
                    <Input id="add-last" name="lastName" maxLength={120} />
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="add-linkedin">LinkedIn profile URL</Label>
                  <Input
                    id="add-linkedin"
                    name="linkedinUrl"
                    required
                    placeholder="linkedin.com/in/…"
                    inputMode="url"
                  />
                </div>
                <div className="grid gap-3.5 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="add-title">Title</Label>
                    <Input id="add-title" name="title" maxLength={120} placeholder="Optional" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="add-company">Company</Label>
                    <Input id="add-company" name="companyName" maxLength={120} placeholder="Optional" />
                  </div>
                </div>
                <div className="mt-1 flex items-center justify-end gap-2">
                  <Button type="button" variant="ghost" size="sm" onClick={close} disabled={busy}>
                    Cancel
                  </Button>
                  <Button type="submit" size="sm" disabled={busy}>
                    {busy ? "Adding…" : "Add lead"}
                  </Button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
