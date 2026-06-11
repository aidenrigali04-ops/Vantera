"use client";

import { useActionState } from "react";
import { cancelAccountDeletion, requestAccountDeletion, type SettingsState } from "./actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormError } from "@/components/form-error";

const GRACE_DAYS = 7;

const dateFmt = new Intl.DateTimeFormat("en-US", {
  month: "long",
  day: "numeric",
  year: "numeric",
});

export function DangerZone({
  accountName,
  pendingRequest,
}: {
  accountName: string;
  pendingRequest: { id: string; createdAt: string } | null;
}) {
  const [requestState, requestAction, requestPending] = useActionState<SettingsState, FormData>(
    requestAccountDeletion,
    {}
  );
  const [cancelState, cancelAction, cancelPending] = useActionState<SettingsState, FormData>(
    cancelAccountDeletion,
    {}
  );

  if (pendingRequest) {
    const deleteOn = new Date(pendingRequest.createdAt);
    deleteOn.setDate(deleteOn.getDate() + GRACE_DAYS);
    return (
      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="text-destructive">Deletion scheduled</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm">
            This workspace is scheduled for permanent deletion on{" "}
            <span className="font-medium">{dateFmt.format(deleteOn)}</span>. All data will be
            erased.
          </p>
          <form action={cancelAction} className="mt-4">
            <input type="hidden" name="requestId" value={pendingRequest.id} />
            <FormError message={cancelState.error} />
            <Button type="submit" variant="outline" disabled={cancelPending}>
              {cancelPending ? "Canceling…" : "Cancel deletion"}
            </Button>
          </form>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-destructive/40">
      <CardHeader>
        <CardTitle className="text-destructive">Delete workspace</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Deletes this workspace and all its data after a {GRACE_DAYS}-day grace period. This
          cannot be undone after that.
        </p>
        <form action={requestAction} className="mt-4 flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="confirmName">
              Type <span className="font-medium">{accountName}</span> to confirm
            </Label>
            <Input id="confirmName" name="confirmName" autoComplete="off" required />
          </div>
          <FormError message={requestState.error} />
          <div>
            <Button type="submit" variant="destructive" disabled={requestPending}>
              {requestPending ? "Requesting…" : "Delete workspace"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
