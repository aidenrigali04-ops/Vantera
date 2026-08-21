"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FormError } from "@/components/form-error";
import { addProofPoint, type ProofActionState } from "./actions";

const KINDS = [
  { value: "metric", label: "Stat / metric", hint: "e.g. 42% average show rate on booked calls" },
  { value: "outcome", label: "Result / case study", hint: "e.g. a fintech client booked 12 qualified calls in month one" },
  { value: "pricing", label: "Pricing", hint: "e.g. starts at $2k/mo, usually $2-4k depending on volume" },
  { value: "faq", label: "FAQ answer", hint: "the honest answer to a question you get asked a lot" },
] as const;

export function AddProofForm() {
  const [state, action, pending] = useActionState<ProofActionState, FormData>(addProofPoint, {});
  const [kind, setKind] = useState<string>("metric");
  const formRef = useRef<HTMLFormElement>(null);
  const active = KINDS.find((k) => k.value === kind) ?? KINDS[0];

  // Clear the inputs after a successful add so the next fact starts fresh.
  useEffect(() => {
    if (state.added) formRef.current?.reset();
  }, [state.added]);

  return (
    <form ref={formRef} action={action} className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="kind">Type</Label>
          <select
            id="kind"
            name="kind"
            value={kind}
            onChange={(e) => setKind(e.target.value)}
            className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
          >
            {KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {kind === "faq" && (
        <div className="space-y-1.5">
          <Label htmlFor="question">The question prospects ask</Label>
          <Input id="question" name="question" placeholder="Do you train on my past messages?" />
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="text">{kind === "faq" ? "Your honest answer" : "The fact, exactly as you'd want it quoted"}</Label>
        <Textarea id="text" name="text" rows={2} placeholder={active.hint} className="text-sm" required />
        <p className="text-xs text-muted-foreground">
          Keep it to one short, true line. Your agent quotes it verbatim, only when a prospect asks
          for proof or price.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Add proof point"}
        </Button>
        <FormError message={state.error} />
        {state.added && <p className="text-sm text-muted-foreground">Added.</p>}
      </div>
    </form>
  );
}
