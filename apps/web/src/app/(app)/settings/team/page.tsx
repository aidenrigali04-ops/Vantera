import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { getGateData } from "@/lib/auth/context";
import { resolveEntitlements } from "@vantera/billing";
import { snapshotFromRow, type AccountBillingRow } from "@/lib/billing/entitlement";
import { canManageTeam } from "./validation";
import { InviteForm, RevokeInviteButton, RemoveMemberButton } from "./team-forms";

export default async function TeamPage() {
  const { user, account } = await getGateData();
  if (!user || !account) return null;

  const supabase = await createClient();

  const [{ data: members }, { data: invites }, { data: billingRow }] = await Promise.all([
    supabase
      .from("account_members")
      .select("user_id, role")
      .eq("account_id", account.id),
    supabase
      .from("account_invites")
      .select("id, email, role, created_at")
      .eq("account_id", account.id)
      .eq("status", "pending"),
    supabase
      .from("accounts")
      .select(
        "plan, subscription_status, seats_purchased, linkedin_accounts_purchased, current_period_end"
      )
      .eq("id", account.id)
      .maybeSingle<AccountBillingRow>(),
  ]);

  const callerMembership = (members ?? []).find((m) => m.user_id === user.id);
  const callerRole = callerMembership?.role ?? "";
  const canManage = canManageTeam(callerRole);

  const limits = billingRow
    ? resolveEntitlements(snapshotFromRow(billingRow))
    : { maxSeats: 1, maxLinkedinAccounts: 1 };

  const memberCount = (members ?? []).length;
  const pendingCount = (invites ?? []).length;
  const usedSeats = memberCount + pendingCount;

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Team</h1>

      {/* Seat usage */}
      <Card>
        <CardHeader>
          <CardTitle>Seats</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {usedSeats} of {limits.maxSeats} seat{limits.maxSeats === 1 ? "" : "s"} used
            {pendingCount > 0 ? ` (${pendingCount} pending invite${pendingCount > 1 ? "s" : ""})` : ""}
          </p>
        </CardContent>
      </Card>

      {/* Members */}
      <Card>
        <CardHeader>
          <CardTitle>Members</CardTitle>
        </CardHeader>
        <CardContent>
          {(members ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No members found.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {(members ?? []).map((m) => {
                const isYou = m.user_id === user.id;
                const isOwner = m.role === "owner";
                const showRemove = canManage && !isYou && !isOwner;
                return (
                  <li key={m.user_id} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      {isYou ? (user.email ?? "You") : "Team member"}
                      {isYou && (
                        <span className="text-xs text-muted-foreground">(you)</span>
                      )}
                    </span>
                    <span className="flex items-center gap-2">
                      <Badge variant="secondary">{m.role}</Badge>
                      {showRemove && <RemoveMemberButton userId={m.user_id} />}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Pending invites */}
      {((invites ?? []).length > 0 || canManage) && (
        <Card>
          <CardHeader>
            <CardTitle>Pending invites</CardTitle>
          </CardHeader>
          <CardContent>
            {(invites ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No pending invites.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {(invites ?? []).map((inv) => (
                  <li key={inv.id} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      {inv.email}
                    </span>
                    <span className="flex items-center gap-2">
                      <Badge variant="secondary">{inv.role}</Badge>
                      {canManage && <RevokeInviteButton inviteId={inv.id} />}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      {/* Invite form */}
      {canManage && (
        <Card>
          <CardHeader>
            <CardTitle>Invite a teammate</CardTitle>
          </CardHeader>
          <CardContent>
            <InviteForm />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
