import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { createClient } from "@/lib/supabase/server";
import { getGateData } from "@/lib/auth/context";
import { matchMemberEmails } from "./team/validation";
import { EmailForm, PasswordForm, ProfileForm } from "./profile-form";
import { WorkspaceForm } from "./workspace-form";
import { BookingLinkForm } from "./booking-link-form";
import { LeadEventEmailsToggle, LifecycleEmailsToggle, WeeklySummaryToggle } from "./notifications-form";
import { DangerZone } from "./danger-zone";

export const metadata = { title: "Settings" };

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
    { data: copyAgent },
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
        .select("weekly_summary_enabled, lead_event_emails_enabled, lifecycle_emails_enabled")
        .eq("id", account.id)
        .maybeSingle<{
          weekly_summary_enabled: boolean;
          lead_event_emails_enabled: boolean;
          lifecycle_emails_enabled: boolean;
        }>(),
      // R6: the booking link lives on the Outreach agent's config — one source of truth
      // shared with the wizard, drafts, and the dashboard nag.
      supabase
        .from("agents")
        .select("id, config")
        .eq("kind", "copy")
        .limit(1)
        .maybeSingle<{ id: string; config: { bookingUrl?: string | null } | null }>(),
    ]);
  const emailById = matchMemberEmails(members ?? [], acceptedInvites ?? []);
  // T5: role-aware surface — members used to see fully-editable admin forms that only
  // failed on submit (or silently). Admin-only cards now render read-only for members.
  const myRole = (members ?? []).find((m) => m.user_id === user.id)?.role ?? "member";
  const canManage = myRole === "owner" || myRole === "admin";

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
        <EmailForm email={user.email ?? ""} />
        <div className="border-t border-[var(--hairline)] pt-5">
          <ProfileForm displayName={profile?.display_name ?? ""} />
        </div>
        <div className="border-t border-[var(--hairline)] pt-5"><PasswordForm /></div>
      </Panel>

      <Panel className="flex flex-col gap-4">
        <h2 className="font-heading text-base font-semibold">Workspace</h2>
        {canManage ? (
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
        ) : (
          <div className="flex flex-col gap-1.5 text-sm">
            <p><span className="text-muted-foreground">Name:</span> {account.name}</p>
            {account.onboarding_industry && (
              <p><span className="text-muted-foreground">Industry:</span> {account.onboarding_industry}</p>
            )}
            {account.onboarding_icp && (
              <p><span className="text-muted-foreground">ICP:</span> {account.onboarding_icp}</p>
            )}
            <p className="mt-1 text-xs text-muted-foreground">Workspace admins manage these settings.</p>
          </div>
        )}
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

      {/* R6: the conversion-critical config, editable where people look for it. The dashboard
          "Action needed" nag deep-links to this anchor. */}
      <Panel id="booking-link" className="flex flex-col gap-4 scroll-mt-6">
        <h2 className="font-heading text-base font-semibold">Booking link</h2>
        {canManage ? (
          <BookingLinkForm
            bookingUrl={copyAgent?.config?.bookingUrl ?? ""}
            hasAgent={copyAgent != null}
          />
        ) : (
          <p className="text-sm text-muted-foreground">
            {copyAgent?.config?.bookingUrl
              ? `Vera offers ${copyAgent.config.bookingUrl} once a prospect wants to talk.`
              : "Not set yet — a workspace admin can add it here."}
          </p>
        )}
      </Panel>

      <Panel className="flex flex-col gap-4">
        <h2 className="font-heading text-base font-semibold">Notifications</h2>
        {canManage ? (
          <>
            <LeadEventEmailsToggle enabled={prefs?.lead_event_emails_enabled ?? true} />
            <WeeklySummaryToggle enabled={prefs?.weekly_summary_enabled ?? true} />
            <LifecycleEmailsToggle enabled={prefs?.lifecycle_emails_enabled ?? true} />
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            Workspace emails (prospect events, the weekly summary, account notices) go to owners
            and admins — an admin manages the toggles here.
          </p>
        )}
      </Panel>

      <SettingsLink
        title="Billing"
        body="Plan, usage, and payment."
        href="/settings/billing"
        cta="Manage billing"
      />
      <SettingsLink
        title="Senders"
        body="Connect the LinkedIn account your agents send from, plus global pause controls."
        href="/settings/senders"
        cta="Manage senders"
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
        title="Positioning"
        body="Your value proposition, brand voice, and the guardrails your agent must never cross."
        href="/settings/positioning"
        cta="Manage positioning"
      />
      <SettingsLink
        title="Suppression list"
        body="Contacts your agents must never message — unsubscribes, bounces, and manual adds."
        href="/settings/suppression"
        cta="Manage suppression"
      />

      {canManage && (
        <DangerZone
          accountName={account.name}
          pendingRequest={
            deletionRequest
              ? { id: deletionRequest.id, createdAt: deletionRequest.created_at }
              : null
          }
        />
      )}
    </div>
  );
}
