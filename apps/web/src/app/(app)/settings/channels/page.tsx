import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  SenderAddressForm,
  SenderNameForm,
  ProvisionEmailForm,
  PauseSendingForm,
  LinkedInConnectButton,
} from "./channels-forms";
import { ChannelReadiness } from "./channels-readiness";
import { shapeWarmupStatus, estimateReadyInDays } from "@/lib/warmup-status";

interface SenderAddress {
  line1: string;
  line2?: string | null;
  city: string;
  region?: string | null;
  postal: string;
  country: string;
}

type MailboxStatus = "provisioning" | "warming" | "active" | "paused" | "error";

const MAILBOX_STATUS_LABELS: Record<MailboxStatus, string> = {
  provisioning: "Provisioning",
  warming: "Warming up — building sender reputation",
  active: "Ready",
  paused: "Paused",
  error: "Issue",
};

const MAILBOX_STATUS_VARIANTS: Record<
  MailboxStatus,
  "default" | "secondary" | "outline" | "destructive"
> = {
  provisioning: "secondary",
  warming: "secondary",
  active: "default",
  paused: "outline",
  error: "destructive",
};

export default async function ChannelsPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string }>;
}) {
  const { connected } = await searchParams;
  const supabase = await createClient();

  const [
    { data: accountRow },
    { data: mailboxRows },
    { data: linkedinRows },
  ] = await Promise.all([
    supabase
      .from("accounts")
      .select("sender_address, sender_name, outreach_paused")
      .limit(1)
      .maybeSingle<{ sender_address: SenderAddress | null; sender_name: string | null; outreach_paused: boolean }>(),
    supabase
      .from("mailboxes")
      .select("id, email_address, domain, status, daily_send_limit, warmup_started_at")
      .order("created_at", { ascending: true }),
    supabase
      .from("linkedin_accounts")
      .select("id, profile_url, display_name, status")
      .order("created_at", { ascending: true }),
  ]);

  const senderAddress = accountRow?.sender_address ?? null;
  const senderName = accountRow?.sender_name ?? "";
  const outreachPaused = accountRow?.outreach_paused ?? false;
  const mailboxes = mailboxRows ?? [];
  const linkedinAccounts = linkedinRows ?? [];

  // Channel readiness for the header — derived from the same rows the cards render,
  // via the tested pure helper (no extra round-trip). Only warming/active mailboxes
  // count toward warmup, matching getWarmupStatus semantics.
  const now = new Date();
  const warmup = shapeWarmupStatus({
    mailboxes: mailboxes
      .filter((m) => m.status === "warming" || m.status === "active")
      .map((m) => ({
        status: m.status,
        warmupStartedAt: m.warmup_started_at ? new Date(m.warmup_started_at) : null,
      })),
    linkedinConnected: linkedinAccounts.some((la) => la.status === "active"),
    now,
  });

  const senderAddressDefaults = {
    line1: senderAddress?.line1 ?? "",
    line2: senderAddress?.line2 ?? "",
    city: senderAddress?.city ?? "",
    region: senderAddress?.region ?? "",
    postal: senderAddress?.postal ?? "",
    country: senderAddress?.country ?? "",
  };

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Channels</h1>
        <p className="text-sm text-muted-foreground">
          Configure email sending and LinkedIn for your outreach agents.{" "}
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

      {/* Readiness header — value proof + endowed progress toward "channels live" */}
      <ChannelReadiness warmup={warmup} />

      {/* Email sending card */}
      <Card>
        <CardHeader>
          <CardTitle>Email sending</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Sender name — personalises the email sign-off */}
          <div className="space-y-3">
            <div>
              <p className="text-sm font-medium">Sender name</p>
            </div>
            <SenderNameForm defaultValue={senderName} />
          </div>

          {/* Sender address — required for CAN-SPAM (rule 11) */}
          <div className="space-y-3">
            <div>
              <p className="text-sm font-medium">Business mailing address</p>
              <p className="text-sm text-muted-foreground">
                U.S. anti-spam law (CAN-SPAM) requires a real postal address in the footer of
                every cold email — it&apos;s printed publicly there, never shared or used for
                anything else. A business address, PO box, or virtual mailbox all work; just
                don&apos;t use your home.
              </p>
            </div>
            <SenderAddressForm defaultValues={senderAddressDefaults} />
          </div>

          {/* Mailboxes: provision form or list */}
          <div className="space-y-3">
            <div>
              <p className="text-sm font-medium">Sending mailboxes</p>
              {mailboxes.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No mailboxes set up yet. Add your sender address above, then provision
                  mailboxes below.
                </p>
              ) : null}
            </div>
            {mailboxes.length === 0 ? (
              <ProvisionEmailForm />
            ) : (
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="pb-2 font-medium">Address</th>
                    <th className="pb-2 font-medium">Status</th>
                    <th className="pb-2 font-medium">Daily cap</th>
                  </tr>
                </thead>
                <tbody>
                  {mailboxes.map((m) => {
                    const status = (m.status ?? "provisioning") as MailboxStatus;
                    const eta =
                      status === "warming"
                        ? estimateReadyInDays(
                            m.warmup_started_at ? new Date(m.warmup_started_at) : null,
                            now
                          )
                        : null;
                    return (
                      <tr key={m.id} className="border-t border-border">
                        <td className="py-2 font-medium">{m.email_address}</td>
                        <td className="py-2">
                          <div className="flex flex-col items-start gap-0.5">
                            <Badge variant={MAILBOX_STATUS_VARIANTS[status]}>
                              {MAILBOX_STATUS_LABELS[status] ?? m.status}
                            </Badge>
                            {eta !== null && (
                              <span className="text-xs text-muted-foreground">
                                ~{eta}d to ready
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-2 text-muted-foreground">
                          {m.daily_send_limit ?? "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </CardContent>
      </Card>

      {/* LinkedIn card */}
      <Card>
        <CardHeader>
          <CardTitle>LinkedIn</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {linkedinAccounts.length === 0 ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Connect your own LinkedIn account to enable LinkedIn outreach. You&apos;ll sign in
                on LinkedIn&apos;s own page — we never see your password.
              </p>
              <LinkedInConnectButton variant="default" />
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
                        {(la.status === "disconnected" || la.status === "restricted") && (
                          <LinkedInConnectButton label="Reconnect" variant="outline" />
                        )}
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
              <LinkedInConnectButton label="Connect another account" variant="ghost" />
            </div>
          )}
        </CardContent>
      </Card>

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
