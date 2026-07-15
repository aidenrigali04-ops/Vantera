import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  PauseSendingForm,
  LinkedInConnectButton,
  LinkedInReconnectButton,
  RemoveLinkedInButton,
  RefreshLinkedInButton,
} from "./channels-forms";
import { reconcileLinkedInAccounts } from "@/lib/linkedin/sync";

export default async function ChannelsPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string }>;
}) {
  const { connected } = await searchParams;
  const supabase = await createClient();

  const { data: accountRow } = await supabase
    .from("accounts")
    .select("id, outreach_paused")
    .limit(1)
    .maybeSingle<{ id: string; outreach_paused: boolean }>();

  // On return from the connect flow, reconcile against the provider so the account
  // shows immediately even if the hosted-auth status webhook was missed (best-effort).
  if (connected === "1" && accountRow?.id) {
    try {
      await reconcileLinkedInAccounts(accountRow.id);
    } catch (err) {
      console.error("channels reconcile on connect failed:", err);
    }
  }

  const { data: linkedinRows } = await supabase
    .from("linkedin_accounts")
    .select("id, profile_url, display_name, status")
    .order("created_at", { ascending: true });

  const outreachPaused = accountRow?.outreach_paused ?? false;
  const linkedinAccounts = linkedinRows ?? [];

  // P1 safety visibility: the pacing the Safety page promises, shown against real counts.
  // Ceilings mirror packages/jobs/src/pipeline/safety-limits.ts (locked, rule 04).
  const weekAgoIso = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const dayAgoIso = new Date(Date.now() - 86_400_000).toISOString();
  const { data: weekSendRows } = await supabase
    .from("outreach_sends")
    .select("linkedin_account_id, sent_at, scheduled_sends(linkedin_stage)")
    .gte("sent_at", weekAgoIso)
    .returns<{ linkedin_account_id: string | null; sent_at: string; scheduled_sends: { linkedin_stage: string | null } | null }[]>();
  const pacing = new Map<string, { invites7d: number; invitesToday: number; messagesToday: number }>();
  for (const r of weekSendRows ?? []) {
    if (!r.linkedin_account_id) continue;
    const c = pacing.get(r.linkedin_account_id) ?? { invites7d: 0, invitesToday: 0, messagesToday: 0 };
    const invite = r.scheduled_sends?.linkedin_stage === "invite";
    if (invite) c.invites7d++;
    if (r.sent_at >= dayAgoIso) {
      if (invite) c.invitesToday++;
      else c.messagesToday++;
    }
    pacing.set(r.linkedin_account_id, c);
  }
  const WEEKLY_INVITE_CEILING = 100;
  const DAILY_MESSAGES = 25;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div className="border-b border-[var(--hairline)] pb-5">
        <h1 className="text-2xl font-semibold tracking-tight">LinkedIn</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Connect the LinkedIn account your agents send from — it&apos;s the one step before
          outreach can go out.{" "}
          <Link href="/settings" className="underline underline-offset-2">
            Back to settings
          </Link>
        </p>
      </div>

      {connected === "1" && (
        <div role="status" className="rounded-md border border-border bg-muted/40 px-4 py-3 text-sm">
          LinkedIn connection submitted — your account will appear here in a moment.
        </div>
      )}
      {connected === "failed" && (
        <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          That LinkedIn connection didn&apos;t complete. You can try connecting again below.
        </div>
      )}

      {/* LinkedIn card */}
      <Card>
        <CardHeader>
          <CardTitle>Connected accounts</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {linkedinAccounts.length === 0 ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Connect your own LinkedIn account to enable outreach. You&apos;ll sign in on
                LinkedIn&apos;s own page — we never see your password.
              </p>
              <LinkedInConnectButton variant="default" />
              <p className="text-xs text-muted-foreground">
                Just finished connecting and don&apos;t see it yet?{" "}
                <RefreshLinkedInButton inline />
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="pb-2 font-medium">Account</th>
                    <th className="pb-2 font-medium">Status</th>
                    <th className="pb-2 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {linkedinAccounts.map((la) => (
                    <tr key={la.id} className="border-t border-border">
                      <td className="py-2 font-medium">
                        {la.display_name ?? la.profile_url ?? "Unknown account"}
                      </td>
                      <td className="py-2">
                        <Badge
                          variant={
                            la.status === "active"
                              ? "default"
                              : la.status === "disconnected" || la.status === "restricted"
                              ? "destructive"
                              : "secondary"
                          }
                        >
                          {la.status === "active"
                            ? "Active"
                            : la.status === "connecting"
                            ? "Connecting"
                            : la.status === "restricted"
                            ? "Restricted"
                            : "Disconnected"}
                        </Badge>
                      </td>
                      <td className="py-2">
                        <span className="flex items-center justify-end gap-1">
                          {(la.status === "disconnected" || la.status === "restricted") && (
                            // Reconnect IN PLACE — same seat, same row. A plain connect here
                            // used to mint a duplicate billable seat for the same person.
                            <LinkedInReconnectButton rowId={la.id} />
                          )}
                          <RemoveLinkedInButton
                            rowId={la.id}
                            name={la.display_name ?? la.profile_url ?? "this account"}
                          />
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {linkedinAccounts.some(
                (la) => la.status === "disconnected" || la.status === "restricted"
              ) && (
                <p className="text-xs text-muted-foreground">
                  Reconnect any flagged or disconnected account to resume LinkedIn outreach —
                  sessions expire periodically.
                </p>
              )}
              <div className="flex items-center gap-2">
                <LinkedInConnectButton label="Connect another account" variant="ghost" />
                <RefreshLinkedInButton />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* P1 safety visibility: the ramp/ceiling/pacing the Safety page promises, with real
          numbers per sender. Read-only by design — the limits are compliance, not settings. */}
      {linkedinAccounts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Account-safe pacing</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {linkedinAccounts.map((li) => {
              const c = pacing.get(li.id) ?? { invites7d: 0, invitesToday: 0, messagesToday: 0 };
              const pct = Math.min(100, Math.round((c.invites7d / WEEKLY_INVITE_CEILING) * 100));
              return (
                <div key={li.id} className="space-y-1.5">
                  <p className="text-sm font-medium">{li.display_name ?? "LinkedIn account"}</p>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-foreground/[0.08]">
                    <span className="block h-full rounded-full bg-[var(--cyan-strong)]" style={{ width: `${pct}%` }} />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {c.invites7d} of {WEEKLY_INVITE_CEILING} invites this week · {c.invitesToday} today ·{" "}
                    {c.messagesToday} of {DAILY_MESSAGES} messages today. New accounts ramp gradually
                    (5→10→15→20/day over four weeks) — these ceilings protect your account and can&apos;t
                    be raised past the safe line.
                  </p>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Pause all sending card */}
      <Card>
        <CardHeader>
          <CardTitle>Pause all sending</CardTitle>
        </CardHeader>
        <CardContent>
          <PauseSendingForm outreachPaused={outreachPaused} />
        </CardContent>
      </Card>
    </div>
  );
}
