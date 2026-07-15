import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { createClient } from "@/lib/supabase/server";
import { getGateData } from "@/lib/auth/context";
import { matchMemberEmails } from "./team/validation";
import { PasswordForm, ProfileForm } from "./profile-form";
import { WorkspaceForm } from "./workspace-form";
import { LeadEventEmailsToggle, WeeklySummaryToggle } from "./notifications-form";
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
  const [
    { data: profile },
    { data: members },
    { data: deletionRequest },
    { data: acceptedInvites },
    { data: prefs },
  ] = await Promise.all([
      supabase.from("user_profiles").select("display_name").maybeSingle(),
      supabase.from("account_members").select("user_id, role, created_at").eq("account_id", account.id),
      supabase
        .from("account_deletion_requests")
        .select("id, created_at")
        .eq("account_id", account.id)
        .eq("status", "pending")
        .maybeSingle(),
      // Real names on the roster: accepted-invite emails, zipped to members in join order
      // (see matchMemberEmails — invites are email-verified at accept time).
      supabase
        .from("account_invites")
        .select("email, accepted_at")
        .eq("account_id", account.id)
        .eq("status", "accepted")
        .returns<{ email: string; accepted_at: string | null }[]>(),
      supabase
        .from("accounts")
        .select("weekly_summary_enabled, lead_event_emails_enabled")
        .eq("id", account.id)
        .maybeSingle<{ weekly_summary_enabled: boolean; lead_event_emails_enabled: boolean }>(),
    ]);
  const emailById = matchMemberEmails(members ?? [], acceptedInvites ?? []);

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
        <div className="border-t border-[var(--hairline)] pt-5"><PasswordForm /></div>
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
              <span>
                {(m.user_id === user.id ? user.email : emailById.get(m.user_id)) ?? "Team member"}
              </span>
              <Badge variant="secondary">{m.role}</Badge>
            </li>
          ))}
        </ul>
        <p className="text-sm text-muted-foreground">Invite teammates and manage roles.</p>
        <Button asChild variant="outline" size="sm" className="w-fit">
          <Link href="/settings/team">Manage team</Link>
        </Button>
      </Panel>

      <Panel className="flex flex-col gap-4">
        <h2 className="font-heading text-base font-semibold">Notifications</h2>
        <LeadEventEmailsToggle enabled={prefs?.lead_event_emails_enabled ?? true} />
        <WeeklySummaryToggle enabled={prefs?.weekly_summary_enabled ?? true} />
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
        title="Proof & pricing"
        body="The true stats, results, pricing, and FAQ answers your agent can cite when a prospect asks for proof."
        href="/settings/proof"
        cta="Manage proof points"
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
