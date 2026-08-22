import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getGateData, toGateContext } from "@/lib/auth/context";
import { loginRedirect, resolveGate } from "@/lib/auth/gate";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "./actions";
import { pauseEngine, resumeEngine } from "./engine-actions";
import { TopChrome } from "@/components/chrome";
import { Wash } from "@/components/today";
import type { AppNotification } from "@/components/notifications/notifications-bell";
import CopilotOverlay from "@/components/copilot/copilot-overlay";
import { ClarityIdentity } from "@/components/analytics/clarity-identity";
import { RouteEvents } from "@/components/analytics/route-events";
import { TrialBanner, type TrialBannerProps } from "@/components/billing/trial-banner";
import { Toaster } from "@/components/ui/sonner";
import { trialDaysLeft, isTrialExpired } from "@vantera/billing";

/** R2: app tabs get real names — "Prospects · Vantera", not five identical marketing titles.
 *  Scoped here (not the root layout) so marketing pages keep their full SEO titles. */
export const metadata = {
  title: { template: "%s · Vantera", default: "Vantera" },
};

/** Honest per-event copy. A reply's body carries its classification (inbound pipeline), so an
 *  interested reply and a not-interested one read as the different events they are. */
function noteVerb(kind: AppNotification["kind"], body: string): string {
  if (kind === "reply") {
    if (body.includes("not_interested") || body.includes("not interested")) {
      return "replied — not interested, the sequence stopped";
    }
    if (body.includes("interested")) return "replied interested — read it and jump in";
    return "replied — read it and jump in";
  }
  return {
    converted: "closed — a new client",
    exhausted: "went cold after the full sequence",
    hot_signal: "is heating up — a fresh buying signal, worth reaching out now",
    needs_human: "needs YOU — the agent hit its conversation limit, take the thread over",
    meeting_booked: "booked a meeting — it's on your meetings list",
  }[kind];
}

/** Pin-point navigation: lead-scoped events land on THAT prospect's page, not a generic tab. */
function noteHref(kind: AppNotification["kind"], leadId: string): string {
  if (kind === "converted") return "/dashboard?view=pipeline";
  return `/prospects/${leadId}`;
}

// Relative time on the server → passed as a static string (no client Date.now()).
function noteTimeAgo(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.round(hrs / 24)}d`;
}

/**
 * The app shell (Dashboard blueprint v1.0, D1): a 64px top chrome band on a light canvas —
 * the dock rail is retired. The band costs no horizontal space, which the wide data
 * surfaces (Approvals, Prospects) get back.
 *
 * Shell data stays ONE round-trip: every app navigation pays this layout's latency, so the
 * reads below fire concurrently and each degrades to empty rather than crashing the frame.
 * All reads are RLS-scoped to the session's account (rule 02) — no account id is passed.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const data = await getGateData();
  const dest = resolveGate("app", toGateContext(data));
  // Preserve the requested path through the login bounce so email/deep-link CTAs land on the
  // surface they promised (e.g. /approvals) instead of dead-ending on /today after sign-in.
  const pathname = (await headers()).get("x-pathname");
  if (dest) redirect(loginRedirect(dest, pathname));
  // Today owns the banner slot (blueprint Z1): its copy names the sender and says the drafts
  // are held, and it deliberately shows no trial countdown (D9). Rendering the app-wide
  // strips there too would double the same warning.
  const onToday = (pathname ?? "").startsWith("/today");

  const supabase = await createClient();
  const [
    { count: reviewCount },
    { data: notes },
    { data: billing },
    { count: unhealthyConnections },
    { data: profile },
    { data: waitingReplies },
  ] = await Promise.all([
    supabase.from("scheduled_sends").select("id", { count: "exact", head: true }).eq("status", "pending_review"),
    // Recent lead events for the bell — read AND unread, so opening it always rewards the
    // click with recent history (an unread-only feed goes permanently empty once opened).
    supabase
      .from("lead_notifications")
      .select("id, kind, lead_id, body, created_at, read_at")
      .order("created_at", { ascending: false })
      .limit(20)
      .returns<
        { id: string; kind: AppNotification["kind"]; lead_id: string; body: string; created_at: string; read_at: string | null }[]
      >(),
    supabase
      .from("accounts")
      .select("name, plan, subscription_status, trial_ends_at, paused_at")
      .limit(1)
      .maybeSingle<{
        name: string | null;
        plan: string;
        subscription_status: string;
        trial_ends_at: string | null;
        paused_at: string | null;
      }>(),
    // Dead LinkedIn connection = every agent silently stopped (no sourcing, no sends, no
    // replies coming in) — the one state that must never be invisible (2026-07-08 incident).
    supabase.from("linkedin_accounts").select("id", { count: "exact", head: true }).in("status", ["disconnected", "restricted"]),
    supabase.from("user_profiles").select("display_name").maybeSingle<{ display_name: string | null }>(),
    // The Inbox badge: replies with no delivered message after them (the waiting rule).
    supabase
      .from("replies")
      .select("lead_id, received_at")
      .in("classification", ["interested", "neutral", "other"])
      .order("received_at", { ascending: false })
      .limit(60)
      .returns<{ lead_id: string; received_at: string }[]>(),
  ]);

  const noteLeadIds = [...new Set((notes ?? []).map((n) => n.lead_id))];
  const { data: noteLeads } = noteLeadIds.length
    ? await supabase
        .from("leads")
        .select("id, first_name, last_name, company_name")
        .in("id", noteLeadIds)
        .returns<{ id: string; first_name: string | null; last_name: string | null; company_name: string | null }[]>()
    : { data: [] as { id: string; first_name: string | null; last_name: string | null; company_name: string | null }[] };
  const noteName = new Map(
    (noteLeads ?? []).map((l) => [l.id, [l.first_name, l.last_name].filter(Boolean).join(" ") || l.company_name || "A prospect"])
  );
  const notifications: AppNotification[] = (notes ?? []).map((n) => ({
    id: n.id,
    kind: n.kind,
    who: noteName.get(n.lead_id) ?? "A prospect",
    verb: noteVerb(n.kind, n.body ?? ""),
    at: noteTimeAgo(n.created_at),
    href: noteHref(n.kind, n.lead_id),
    unread: n.read_at === null,
  }));

  // Inbox badge — one per prospect whose newest reply has no answer after it.
  const replyLeadIds = [...new Set((waitingReplies ?? []).map((r) => r.lead_id))];
  const { data: answered } = replyLeadIds.length
    ? await supabase
        .from("scheduled_sends")
        .select("lead_id, updated_at")
        .in("lead_id", replyLeadIds)
        .eq("status", "sent")
        .eq("linkedin_stage", "message")
        .returns<{ lead_id: string; updated_at: string }[]>()
    : { data: [] as { lead_id: string; updated_at: string }[] };
  const lastAnswer = new Map<string, number>();
  for (const s of answered ?? []) {
    const t = new Date(s.updated_at).getTime();
    if (t > (lastAnswer.get(s.lead_id) ?? 0)) lastAnswer.set(s.lead_id, t);
  }
  const newestReply = new Map<string, number>();
  for (const r of waitingReplies ?? []) {
    const t = new Date(r.received_at).getTime();
    if (t > (newestReply.get(r.lead_id) ?? 0)) newestReply.set(r.lead_id, t);
  }
  const inboxCount = [...newestReply.entries()].filter(([leadId, at]) => (lastAnswer.get(leadId) ?? 0) <= at).length;

  const badges = {
    approvals: reviewCount && reviewCount > 0 ? reviewCount : undefined,
    inbox: inboxCount > 0 ? inboxCount : undefined,
  };

  // Engine-stopping states only (blueprint §6.2 / D9): no trial countdown in this slot.
  let trialBanner: TrialBannerProps | null = null;
  if (billing) {
    if (billing.subscription_status === "trialing" && billing.trial_ends_at === null) {
      trialBanner = {
        tone: "info",
        message: "Your free trial starts the moment you connect LinkedIn — nothing is counting down yet.",
        cta: "Connect LinkedIn",
        href: "/settings/senders",
      };
    } else if (billing.subscription_status === "trialing") {
      const d = trialDaysLeft(billing.trial_ends_at) ?? 0;
      trialBanner = {
        tone: d <= 1 ? "urgent" : "info",
        message:
          d === 0
            ? "Your free trial ends today — choose a plan to keep your agents running."
            : `${d} day${d === 1 ? "" : "s"} left in your free trial — choose a plan to keep your agents running.`,
        cta: "Choose a plan",
        href: "/settings/billing",
      };
    } else if (billing.plan === "none" && isTrialExpired(billing.trial_ends_at)) {
      trialBanner = {
        tone: "ended",
        message: "Your free trial has ended and your agents are paused. Choose a plan to pick up exactly where you left off.",
        cta: "Choose a plan",
        href: "/settings/billing",
      };
    } else if (["past_due", "canceled"].includes(billing.subscription_status)) {
      trialBanner = {
        tone: "ended",
        message: "Your subscription needs attention — new outreach is paused until it's active again.",
        cta: "Manage billing",
        href: "/settings/billing",
      };
    }
  }

  const connectionBanner: TrialBannerProps | null =
    unhealthyConnections && unhealthyConnections > 0
      ? {
          tone: "urgent",
          message: "Your LinkedIn connection dropped — your agents are paused and replies aren't coming in. Reconnect to resume.",
          cta: "Reconnect LinkedIn",
          href: "/settings/senders",
        }
      : null;

  const email = data.user?.email ?? "";
  const initial = email.charAt(0).toUpperCase() || "?";

  return (
    <div className="app-surface relative flex min-h-screen flex-col bg-[var(--canvas)]">
      {/* Today's brand wash lives in the SHELL so it passes behind the chrome band (the band
          is translucent and picks up the colour). Today only — it is a launchpad flourish,
          never decoration on a data surface. */}
      {onToday && <Wash />}
      {/* Session-scoped analytics identity: recordings become filterable by user,
          account, and plan. Values come from the validated session (rule 02). */}
      {data.user && (
        <ClarityIdentity
          userId={data.user.id}
          friendlyName={data.user.email ?? undefined}
          tags={{
            surface: "dashboard",
            accountId: data.account?.id ?? "",
            plan: billing?.plan ?? "",
            subscriptionStatus: billing?.subscription_status ?? "",
          }}
        />
      )}
      <Suspense fallback={null}>
        <RouteEvents />
      </Suspense>

      <TopChrome
        workspaceName={billing?.name?.trim() || data.account?.name || "Your workspace"}
        paused={Boolean(billing?.paused_at)}
        badges={badges}
        notifications={notifications}
        account={{ initial, displayName: profile?.display_name ?? null, email }}
        signOut={signOut}
        pauseEngine={pauseEngine}
        resumeEngine={resumeEngine}
      />

      {/* min-w-0 + overflow-x-clip: no surface can produce a sideways-scrolling page —
          wide content clips (and scrolls inside its own container) instead. */}
      <main className="min-w-0 flex-1 overflow-x-clip pb-24 lg:pb-6">
        {!onToday && (connectionBanner || trialBanner) && (
          <div className="mx-auto w-full max-w-[1248px] px-6 pt-4">
            {connectionBanner && <TrialBanner {...connectionBanner} />}
            {trialBanner && <TrialBanner {...trialBanner} />}
          </div>
        )}
        {children}
      </main>

      <Toaster />
      <CopilotOverlay />
    </div>
  );
}
