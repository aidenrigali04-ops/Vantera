import { createClient } from "@/lib/supabase/server";
import { getGateData } from "@/lib/auth/context";
import { resolveEntitlements } from "@vantera/billing";
import { snapshotFromRow, type AccountBillingRow } from "@/lib/billing/entitlement";
import { canManageTeam } from "./validation";
import { ShareCard, type ShareMember, type ShareInvite } from "@/components/ui/share-card";

export default async function TeamPage() {
  const { user, account } = await getGateData();
  if (!user || !account) return null;

  const supabase = await createClient();

  const [{ data: members }, { data: invites }, { data: billingRow }] = await Promise.all([
    supabase.from("account_members").select("user_id, role").eq("account_id", account.id),
    supabase
      .from("account_invites")
      .select("id, email, role, created_at")
      .eq("account_id", account.id)
      .eq("status", "pending"),
    supabase
      .from("accounts")
      .select("plan, subscription_status, seats_purchased, linkedin_accounts_purchased, current_period_end")
      .eq("id", account.id)
      .maybeSingle<AccountBillingRow>(),
  ]);

  const callerRole = (members ?? []).find((m) => m.user_id === user.id)?.role ?? "";
  const canManage = canManageTeam(callerRole);
  const limits = billingRow
    ? resolveEntitlements(snapshotFromRow(billingRow))
    : { maxSeats: 1, maxLinkedinAccounts: 1 };

  const memberRows: ShareMember[] = (members ?? []).map((m) => {
    const isYou = m.user_id === user.id;
    const isOwner = m.role === "owner";
    return {
      id: m.user_id,
      label: isYou ? user.email ?? "You" : isOwner ? "Workspace owner" : "Team member",
      sublabel: null,
      role: m.role,
      isOwner,
      isYou,
      removable: canManage && !isYou && !isOwner,
    };
  });
  const inviteRows: ShareInvite[] = (invites ?? []).map((i) => ({ id: i.id, email: i.email, role: i.role }));
  const workspaceName = (account as { name?: string | null }).name ?? "Your workspace";

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Team</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Invite teammates into your workspace and manage who has access.
        </p>
      </div>

      <ShareCard
        workspaceName={workspaceName}
        seatsUsed={memberRows.length + inviteRows.length}
        seatsMax={limits.maxSeats}
        members={memberRows}
        invites={inviteRows}
        canManage={canManage}
      />
    </div>
  );
}
