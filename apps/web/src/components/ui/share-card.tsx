"use client";

import { useActionState, useRef } from "react";
import { Loader2, X } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  inviteMember,
  resendInvite,
  revokeInvite,
  removeMember,
  changeMemberRole,
  type TeamActionState,
} from "@/app/(app)/settings/team/actions";
import { cn } from "@/lib/utils";

export type ShareMember = {
  id: string;
  label: string;
  sublabel?: string | null;
  role: string;
  isOwner: boolean;
  isYou: boolean;
  removable: boolean;
};
export type ShareInvite = { id: string; email: string; role: string; expired?: boolean };

function initials(s: string): string {
  const parts = s.replace(/@.*/, "").split(/[.\s_-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? s[0] ?? "?") + (parts[1]?.[0] ?? "")).toUpperCase();
}

function Avatar({ label }: { label: string }) {
  return (
    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-foreground/[0.06] text-[12px] font-semibold text-[var(--ink-2)]">
      {initials(label)}
    </span>
  );
}

function RoleBadge({ role }: { role: string }) {
  return (
    <span className="rounded-full bg-[var(--tint)] px-2.5 py-1 text-[12px] font-medium capitalize text-[var(--ink-2)] ring-1 ring-inset ring-[var(--hairline)]">
      {role}
    </span>
  );
}

/**
 * Workspace share card — invite teammates + see who has access. Wired to the real
 * team model (owner/admin/member). Roles are shown as badges, not editable dropdowns,
 * P1 2026-07-15: RoleSelect now switches admin/member for manageable members.
 */
export function ShareCard({
  workspaceName,
  seatsUsed,
  seatsMax,
  members,
  invites,
  canManage,
}: {
  workspaceName: string;
  seatsUsed: number;
  seatsMax: number;
  members: ShareMember[];
  invites: ShareInvite[];
  canManage: boolean;
}) {
  const [inviteState, inviteAction, inviting] = useActionState<TeamActionState, FormData>(inviteMember, {});
  const seatsLeft = Math.max(0, seatsMax - seatsUsed);

  return (
    <div className="w-full max-w-xl rounded-3xl border border-[var(--hairline)] bg-white p-7 shadow-[var(--shadow-card)]">
      {/* header */}
      <div className="flex items-center gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-foreground text-base font-semibold text-background">
          {initials(workspaceName)}
        </span>
        <div className="min-w-0">
          <h2 className="truncate text-[17px] font-semibold tracking-[-0.02em] text-foreground">{workspaceName}</h2>
          <p className="text-[13px] text-[var(--ink-3)]">
            {seatsUsed} of {seatsMax} seat{seatsMax === 1 ? "" : "s"} used
            {seatsLeft > 0 ? ` · ${seatsLeft} left` : ""}
          </p>
        </div>
      </div>

      {/* invite row */}
      {canManage && (
        <form action={inviteAction} className="mt-6">
          <p className="text-[13px] font-medium text-foreground">Invite a teammate</p>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <input
              name="email"
              type="email"
              required
              placeholder="colleague@company.com"
              autoComplete="off"
              className="h-11 flex-1 rounded-xl border border-[rgba(12,16,26,0.12)] bg-white px-4 text-[14px] text-foreground placeholder:text-[var(--ink-4)] transition-colors focus-visible:border-[var(--cyan-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(11,87,171,0.2)]"
            />
            <select
              name="role"
              defaultValue="member"
              className="h-11 rounded-xl border border-[rgba(12,16,26,0.12)] bg-white px-3 text-[14px] text-foreground transition-colors focus-visible:border-[var(--cyan-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(11,87,171,0.2)]"
            >
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
            <button
              type="submit"
              disabled={inviting || seatsLeft === 0}
              className="inline-flex h-11 items-center justify-center gap-1.5 rounded-xl bg-[#0a0c12] px-5 text-[14px] font-semibold text-white transition-all hover:-translate-y-0.5 hover:shadow-[0_10px_30px_-8px_rgba(11,87,171,0.55)] disabled:opacity-50 disabled:hover:translate-y-0"
            >
              {inviting ? <Loader2 className="size-4 animate-spin" /> : "Send invite"}
            </button>
          </div>
          {inviteState.error && <p className="mt-2 text-[13px] text-destructive">{inviteState.error}</p>}
          {inviteState.success && <p className="mt-2 text-[13px] text-[var(--cyan-strong)]">{inviteState.success}</p>}
          {seatsLeft === 0 && !inviteState.error && (
            <p className="mt-2 text-[12px] text-[var(--ink-4)]">All seats used — add seats in Billing to invite more.</p>
          )}
        </form>
      )}

      {/* access list */}
      <p className="mt-7 text-[13px] font-medium text-foreground">Access</p>
      <ul className="mt-3 flex flex-col">
        {members.map((m) => (
          <li key={m.id} className="flex items-center gap-3 py-2.5">
            <Avatar label={m.label} />
            <div className="min-w-0">
              <p className="truncate text-[14px] font-medium text-foreground">
                {m.label}
                {m.isYou && <span className="ml-1.5 text-[12px] font-normal text-[var(--ink-4)]">(you)</span>}
              </p>
              {m.sublabel && <p className="truncate text-[12.5px] text-[var(--ink-3)]">{m.sublabel}</p>}
            </div>
            <div className="ml-auto flex items-center gap-2">
              {m.isOwner ? (
                <span className="text-[13px] font-medium text-[var(--ink-3)]">Owner</span>
              ) : m.removable ? (
                // P1: role is a control, not a label, for members you can manage
                <RoleSelect userId={m.id} role={m.role} />
              ) : (
                <RoleBadge role={m.role} />
              )}
              {m.removable && <RemoveButton userId={m.id} />}
            </div>
          </li>
        ))}

        {invites.map((inv) => (
          <li key={inv.id} className="flex items-center gap-3 py-2.5">
            <Avatar label={inv.email} />
            <div className="min-w-0">
              <p className="truncate text-[14px] font-medium text-foreground">{inv.email}</p>
              {inv.expired ? (
                <p className="text-[12.5px] font-medium text-amber-700">Invite expired — resend it</p>
              ) : (
                <p className="text-[12.5px] text-[var(--ink-4)]">Invited · awaiting acceptance</p>
              )}
            </div>
            <div className="ml-auto flex items-center gap-2">
              <RoleBadge role={inv.role} />
              {canManage && <ResendButton inviteId={inv.id} />}
              {canManage && <RevokeButton inviteId={inv.id} />}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function RemoveButton({ userId }: { userId: string }) {
  const [state, action, pending] = useActionState<TeamActionState, FormData>(removeMember, {});
  const formRef = useRef<HTMLFormElement>(null);
  return (
    <form ref={formRef} action={action} className="flex items-center gap-2" title="Remove member">
      <input type="hidden" name="userId" value={userId} />
      {state.error && (
        <p role="alert" className="text-[12px] text-destructive">{state.error}</p>
      )}
      <ConfirmDialog
        title="Remove this teammate?"
        description="They lose access to this workspace immediately. Their past work stays; you can invite them again later."
        confirmLabel="Remove teammate"
        destructive
        onConfirm={() => formRef.current?.requestSubmit()}
        trigger={(open) => (
          <button
            type="button"
            onClick={open}
            disabled={pending}
            aria-label="Remove member"
            className={cn(
              "grid size-7 place-items-center rounded-full text-[var(--ink-4)] transition-colors hover:bg-[var(--tint)] hover:text-destructive focus-visible:ring-2 focus-visible:ring-[rgba(11,87,171,0.35)] focus-visible:outline-none disabled:opacity-50",
            )}
          >
            {pending ? <Loader2 className="size-3.5 animate-spin" /> : <X className="size-4" />}
          </button>
        )}
      />
    </form>
  );
}

/** R3: resend a pending invite — fresh 7-day window + the email goes out again. */
function ResendButton({ inviteId }: { inviteId: string }) {
  const [state, action, pending] = useActionState<TeamActionState, FormData>(resendInvite, {});
  return (
    <form action={action} className="flex items-center gap-2" title="Resend invite">
      <input type="hidden" name="inviteId" value={inviteId} />
      {state.error && (
        <p role="alert" className="text-[12px] text-destructive">{state.error}</p>
      )}
      {state.success && <p className="text-[12px] text-[var(--cyan-strong)]">Sent</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded-full px-2.5 py-1 text-[12px] font-medium text-[var(--ink-3)] transition-colors hover:bg-[var(--tint)] hover:text-foreground focus-visible:ring-2 focus-visible:ring-[rgba(11,87,171,0.35)] focus-visible:outline-none disabled:opacity-50"
      >
        {pending ? "Sending…" : "Resend"}
      </button>
    </form>
  );
}

function RevokeButton({ inviteId }: { inviteId: string }) {
  const [state, action, pending] = useActionState<TeamActionState, FormData>(revokeInvite, {});
  const formRef = useRef<HTMLFormElement>(null);
  return (
    <form ref={formRef} action={action} className="flex items-center gap-2" title="Revoke invite">
      <input type="hidden" name="inviteId" value={inviteId} />
      {state.error && (
        <p role="alert" className="text-[12px] text-destructive">{state.error}</p>
      )}
      <ConfirmDialog
        title="Revoke this invite?"
        description="The invite link stops working immediately. You can send a fresh invite anytime."
        confirmLabel="Revoke invite"
        destructive
        onConfirm={() => formRef.current?.requestSubmit()}
        trigger={(open) => (
          <button
            type="button"
            onClick={open}
            disabled={pending}
            className="rounded-full px-2.5 py-1 text-[12px] font-medium text-[var(--ink-3)] transition-colors hover:bg-[var(--tint)] hover:text-destructive focus-visible:ring-2 focus-visible:ring-[rgba(11,87,171,0.35)] focus-visible:outline-none disabled:opacity-50"
          >
            {pending ? "Revoking…" : "Revoke"}
          </button>
        )}
      />
    </form>
  );
}

/** P1: admin↔member switcher — submits on change; the owner role never changes here. */
function RoleSelect({ userId, role }: { userId: string; role: string }) {
  const [state, action, pending] = useActionState<TeamActionState, FormData>(changeMemberRole, {});
  return (
    <form action={action} className="flex items-center gap-2" title="Change role">
      <input type="hidden" name="userId" value={userId} />
      {state.error && (
        <p role="alert" className="text-[12px] text-destructive">{state.error}</p>
      )}
      <select
        name="role"
        defaultValue={role}
        disabled={pending}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="rounded-lg border border-[var(--hairline)] bg-transparent px-2 py-1 text-[13px] font-medium text-[var(--ink-2)] focus-visible:ring-2 focus-visible:ring-[rgba(11,87,171,0.35)] focus-visible:outline-none"
      >
        <option value="admin">admin</option>
        <option value="member">member</option>
      </select>
    </form>
  );
}
