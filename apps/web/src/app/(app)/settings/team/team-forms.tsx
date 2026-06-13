"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormError } from "@/components/form-error";
import {
  inviteMember,
  revokeInvite,
  removeMember,
  type TeamActionState,
} from "./actions";

// ── Invite form ───────────────────────────────────────────────────────────────

export function InviteForm() {
  const [state, action, pending] = useActionState<TeamActionState, FormData>(
    inviteMember,
    {}
  );

  return (
    <form action={action} className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1 sm:col-span-1">
          <Label htmlFor="email">Email address</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="off"
            placeholder="colleague@company.com"
            required
          />
        </div>
        <div className="space-y-1 sm:col-span-1">
          <Label htmlFor="role">Role</Label>
          <select
            id="role"
            name="role"
            defaultValue="member"
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="member">Member</option>
            <option value="admin">Admin</option>
          </select>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Sending…" : "Send invite"}
        </Button>
        {state.success && (
          <p className="text-sm text-muted-foreground">{state.success}</p>
        )}
      </div>
      <FormError message={state.error} />
    </form>
  );
}

// ── Revoke invite button ──────────────────────────────────────────────────────

export function RevokeInviteButton({ inviteId }: { inviteId: string }) {
  const [state, action, pending] = useActionState<TeamActionState, FormData>(
    revokeInvite,
    {}
  );

  return (
    <form action={action}>
      <input type="hidden" name="inviteId" value={inviteId} />
      <div className="flex items-center gap-2">
        <Button type="submit" variant="outline" size="sm" disabled={pending}>
          {pending ? "Revoking…" : "Revoke"}
        </Button>
        {state.error && (
          <p className="text-sm text-destructive">{state.error}</p>
        )}
      </div>
    </form>
  );
}

// ── Remove member button ──────────────────────────────────────────────────────

export function RemoveMemberButton({ userId }: { userId: string }) {
  const [state, action, pending] = useActionState<TeamActionState, FormData>(
    removeMember,
    {}
  );

  return (
    <form action={action}>
      <input type="hidden" name="userId" value={userId} />
      <div className="flex items-center gap-2">
        <Button type="submit" variant="outline" size="sm" disabled={pending}>
          {pending ? "Removing…" : "Remove"}
        </Button>
        {state.error && (
          <p className="text-sm text-destructive">{state.error}</p>
        )}
      </div>
    </form>
  );
}
