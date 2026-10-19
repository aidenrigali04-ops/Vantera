"use client";

import { useActionState } from "react";
import { MAX_HARM_TOLERANCE } from "@vantera/jobs/pipeline/subject";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createAssistedSubject, createSubject, type SubjectActionState } from "./actions";

export function CreateSubjectForm() {
  const [state, action, pending] = useActionState<SubjectActionState, FormData>(createSubject, {});
  return (
    <div className="space-y-10">
      <form action={createAssistedSubject}>
        <Button type="submit" variant="outline">
          Create the first subject for me
        </Button>
      </form>

      <form action={action} className="space-y-9">
        <div className="space-y-3.5">
          <label htmlFor="subject-name" className="text-sm font-medium">
            Subject name
          </label>
          <Input id="subject-name" name="name" required maxLength={80} className="h-11 px-4 text-base" />
          <p className="text-sm text-muted-foreground">A name for what you want this account to learn. Not a strategy.</p>
        </div>

        <div className="space-y-3.5">
          <label htmlFor="harm-tolerance" className="text-sm font-medium">
            Negative-reply tolerance
          </label>
          <Input
            id="harm-tolerance"
            name="harm_tolerance"
            type="number"
            min={0}
            max={MAX_HARM_TOLERANCE}
            step={0.01}
            defaultValue={MAX_HARM_TOLERANCE}
            className="h-11 px-4 text-base"
          />
          <p className="text-sm text-muted-foreground">
            The ceiling is {MAX_HARM_TOLERANCE}. A lower number stops a test sooner when people say no.
          </p>
        </div>

        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" name="auto_adopt" className="mt-1" />
          <span>
            <span className="font-medium">Start approved tests without asking</span>
            <span className="mt-1 block text-muted-foreground">
              Leave this off. A proposed test then waits in Approvals before anyone is contacted differently.
            </span>
          </span>
        </label>

        {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}

        <Button type="submit" disabled={pending}>
          {pending ? "Creating…" : "Create subject"}
        </Button>
      </form>
    </div>
  );
}
