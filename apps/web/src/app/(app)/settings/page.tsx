import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { getGateData } from "@/lib/auth/context";
import { ProfileForm } from "./profile-form";
import { WorkspaceForm } from "./workspace-form";
import { DangerZone } from "./danger-zone";

export default async function SettingsPage() {
  const { user, account } = await getGateData();
  if (!user || !account) return null; // layout gate guarantees this; satisfies TS

  const supabase = await createClient();
  const [{ data: profile }, { data: members }, { data: deletionRequest }] = await Promise.all([
    supabase.from("user_profiles").select("display_name").maybeSingle(),
    supabase.from("account_members").select("user_id, role").eq("account_id", account.id),
    supabase
      .from("account_deletion_requests")
      .select("id, created_at")
      .eq("account_id", account.id)
      .eq("status", "pending")
      .maybeSingle(),
  ]);

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
        </CardHeader>
        <CardContent>
          <ProfileForm displayName={profile?.display_name ?? ""} email={user.email ?? ""} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Workspace</CardTitle>
        </CardHeader>
        <CardContent>
          <WorkspaceForm
            name={account.name}
            industry={account.onboarding_industry ?? ""}
            icp={account.onboarding_icp ?? ""}
            revenueGoalDollars={
              account.revenue_goal_cents ? String(account.revenue_goal_cents / 100) : ""
            }
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Team</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col gap-2">
            {(members ?? []).map((m) => (
              <li key={m.user_id} className="flex items-center justify-between text-sm">
                <span>{m.user_id === user.id ? (user.email ?? "You") : "Team member"}</span>
                <Badge variant="secondary">{m.role}</Badge>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-sm text-muted-foreground">Team invites are coming soon.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Channels</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Email sending mailboxes, LinkedIn account, and global pause controls.
          </p>
          <Button asChild variant="outline" size="sm" className="mt-3">
            <Link href="/settings/channels">Manage channels</Link>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Suppression list</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Contacts your agents must never message — unsubscribes, bounces, and manual adds.
          </p>
          <Button asChild variant="outline" size="sm" className="mt-3">
            <Link href="/settings/suppression">Manage suppression</Link>
          </Button>
        </CardContent>
      </Card>

      <DangerZone
        accountName={account.name}
        pendingRequest={
          deletionRequest
            ? { id: deletionRequest.id, createdAt: deletionRequest.created_at }
            : null
        }
      />
    </div>
  );
}
