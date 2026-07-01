import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { createClient } from "@/lib/supabase/server";
import { getGateData } from "@/lib/auth/context";
import { ProfileForm } from "./profile-form";
import { WorkspaceForm } from "./workspace-form";
import { DangerZone } from "./danger-zone";

function SettingsLink({ title, body, href, cta }: { title: string; body: string; href: string; cta: string }) {
  return (
    <Panel interactive className="flex flex-col gap-3">
      <h2 className="font-heading text-base font-semibold">{title}</h2>
      <p className="text-sm text-muted-foreground">{body}</p>
      <Button asChild variant="outline" size="sm" className="w-fit">
        <Link href={href}>{cta}</Link>
      </Button>
    </Panel>
  );
}

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
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div className="border-b border-[var(--hairline)] pb-5">
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Your profile, workspace, team, billing, and connections.
        </p>
      </div>

      <Panel className="flex flex-col gap-4">
        <h2 className="font-heading text-base font-semibold">Profile</h2>
        <ProfileForm displayName={profile?.display_name ?? ""} email={user.email ?? ""} />
      </Panel>

      <Panel className="flex flex-col gap-4">
        <h2 className="font-heading text-base font-semibold">Workspace</h2>
        <WorkspaceForm
          name={account.name}
          industry={account.onboarding_industry ?? ""}
          icp={account.onboarding_icp ?? ""}
          revenueGoalDollars={
            account.revenue_goal_cents ? String(account.revenue_goal_cents / 100) : ""
          }
          avgDealValueDollars={
            account.avg_deal_value_cents ? String(account.avg_deal_value_cents / 100) : ""
          }
        />
      </Panel>

      <Panel className="flex flex-col gap-3">
        <h2 className="font-heading text-base font-semibold">Team</h2>
        <ul className="flex flex-col gap-2">
          {(members ?? []).map((m) => (
            <li key={m.user_id} className="flex items-center justify-between text-sm">
              <span>{m.user_id === user.id ? (user.email ?? "You") : "Team member"}</span>
              <Badge variant="secondary">{m.role}</Badge>
            </li>
          ))}
        </ul>
        <p className="text-sm text-muted-foreground">Invite teammates and manage roles.</p>
        <Button asChild variant="outline" size="sm" className="w-fit">
          <Link href="/settings/team">Manage team</Link>
        </Button>
      </Panel>

      <SettingsLink
        title="Billing"
        body="Plan, usage, and payment."
        href="/settings/billing"
        cta="Manage billing"
      />
      <SettingsLink
        title="LinkedIn"
        body="Connect the LinkedIn account your agents send from, plus global pause controls."
        href="/settings/channels"
        cta="Manage LinkedIn"
      />
      <SettingsLink
        title="CRM & integrations"
        body="Push closed-won deals into your CRM and notification tools."
        href="/settings/integrations"
        cta="Manage integrations"
      />
      <SettingsLink
        title="Suppression list"
        body="Contacts your agents must never message — unsubscribes, bounces, and manual adds."
        href="/settings/suppression"
        cta="Manage suppression"
      />

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
