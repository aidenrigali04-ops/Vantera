"use client";

import { useActionState } from "react";
import { updateWorkspace, type SettingsState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormError } from "@/components/form-error";

export function WorkspaceForm({
  name,
  industry,
  icp,
  revenueGoalDollars,
}: {
  name: string;
  industry: string;
  icp: string;
  revenueGoalDollars: string;
}) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(updateWorkspace, {});
  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="name">Workspace name</Label>
        <Input id="name" name="name" defaultValue={name} required />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="industry">Industry</Label>
        <Input id="industry" name="industry" defaultValue={industry} required />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="icp">Ideal customer profile</Label>
        <Input id="icp" name="icp" defaultValue={icp} required />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="revenueGoal">Monthly revenue goal (USD)</Label>
        <Input
          id="revenueGoal"
          name="revenueGoal"
          inputMode="decimal"
          defaultValue={revenueGoalDollars}
          required
        />
        <p className="text-xs text-muted-foreground">
          Industry, ICP, and goal seed your default campaign targeting.
        </p>
      </div>
      <FormError message={state.error} />
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save workspace"}
        </Button>
        {state.saved && <span className="text-sm text-muted-foreground">Saved</span>}
      </div>
    </form>
  );
}
