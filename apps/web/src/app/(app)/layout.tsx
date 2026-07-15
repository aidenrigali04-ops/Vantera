import Link from "next/link";
import { redirect } from "next/navigation";
import { LogOut } from "lucide-react";
import { getGateData, toGateContext } from "@/lib/auth/context";
import { resolveGate } from "@/lib/auth/gate";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "./actions";
import { DockNav, DockTooltip } from "@/components/dock-nav";
import { VanteraLogo } from "@/components/landing/vantera-logo";
import { NotificationsBell, type AppNotification } from "@/components/notifications/notifications-bell";
import CopilotOverlay from "@/components/copilot/copilot-overlay";
import { GlassFilter } from "@/components/ui/liquid-glass";
import { ClarityIdentity } from "@/components/analytics/clarity-identity";
import { RouteEvents } from "@/components/analytics/route-events";
import { Suspense } from "react";
import { TrialBanner, type TrialBannerProps } from "@/components/billing/trial-banner";
import { trialDaysLeft, isTrialExpired } from "@vantera/billing";

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
    converted: "booked a meeting",
    exhausted: "went cold after the full sequence",
    hot_signal: "is heating up — a fresh buying signal, worth reaching out now",
    needs_human: "needs YOU — the agent hit its conversation limit, take the thread over",
  }[kind];
}

/** Pin-point navigation: lead-scoped events land on THAT lead's page, not a generic tab. */
function noteHref(kind: AppNotification["kind"], leadId: string): string {
  if (kind === "converted") return "/dashboard?view=pipeline";
  return `/leads/${leadId}`;
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

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const data = await getGateData();
  const dest = resolveGate("app", toGateContext(data));
  if (dest) redirect(dest);

  // Real data behind the dock's badge: drafts waiting in the review queue.
  // RLS scopes this to the session's account (rule 02) — no account id passed.
  const supabase = await createClient();
  const { count } = await supabase
    .from("scheduled_sends")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending_review");
  const badges = count && count > 0 ? { review: count } : undefined;

  // Recent lead events for the dock bell — read AND unread, so opening the bell always
  // rewards the click with the recent history (an unread-only feed goes permanently empty
  // the moment it's opened once). Unread stays visually distinct; only unread gets marked.
  const { data: notes } = await supabase
    .from("lead_notifications")
    .select("id, kind, lead_id, body, created_at, read_at")
    .order("created_at", { ascending: false })
    .limit(20)
    .returns<
      {
        id: string;
        kind: AppNotification["kind"];
        lead_id: string;
        body: string;
        created_at: string;
        read_at: string | null;
      }[]
    >();
  const noteLeadIds = [...new Set((notes ?? []).map((n) => n.lead_id))];
  const { data: noteLeads } = noteLeadIds.length
    ? await supabase
        .from("leads")
        .select("id, first_name, last_name, company_name")
        .in("id", noteLeadIds)
        .returns<
          { id: string; first_name: string | null; last_name: string | null; company_name: string | null }[]
        >()
    : {
        data: [] as {
          id: string;
          first_name: string | null;
          last_name: string | null;
          company_name: string | null;
        }[],
      };
  const noteName = new Map(
    (noteLeads ?? []).map((l) => [
      l.id,
      [l.first_name, l.last_name].filter(Boolean).join(" ") || l.company_name || "A lead",
    ])
  );
  const notifications: AppNotification[] = (notes ?? []).map((n) => ({
    id: n.id,
    kind: n.kind,
    who: noteName.get(n.lead_id) ?? "A lead",
    verb: noteVerb(n.kind, n.body ?? ""),
    at: noteTimeAgo(n.created_at),
    href: noteHref(n.kind, n.lead_id),
    unread: n.read_at === null,
  }));

  // Soft-lock trial strip: a live countdown while trialing, a clear "paused" state once
  // it lapses. Server-set billing columns only (RLS-scoped) — never a placeholder.
  const { data: billing } = await supabase
    .from("accounts")
    .select("plan, subscription_status, trial_ends_at")
    .limit(1)
    .maybeSingle<{ plan: string; subscription_status: string; trial_ends_at: string | null }>();

  let trialBanner: TrialBannerProps | null = null;
  if (billing) {
    if (billing.subscription_status === "trialing") {
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
        message:
          "Your free trial has ended and your agents are paused. Choose a plan to pick up exactly where you left off.",
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

  // Dead LinkedIn connection = every agent silently stopped (no sourcing, no sends, no
  // replies coming in) — the one state that must never be invisible (2026-07-08 incident).
  // The account-health cron reconciles the status; this banner is its user-facing half.
  const { count: unhealthyConnections } = await supabase
    .from("linkedin_accounts")
    .select("id", { count: "exact", head: true })
    .in("status", ["disconnected", "restricted"]);
  const connectionBanner: TrialBannerProps | null =
    unhealthyConnections && unhealthyConnections > 0
      ? {
          tone: "urgent",
          message:
            "Your LinkedIn connection dropped — your agents are paused and replies aren't coming in. Reconnect to resume.",
          cta: "Reconnect LinkedIn",
          href: "/settings/channels",
        }
      : null;

  const email = data.user?.email ?? "";
  const initial = email.charAt(0).toUpperCase() || "?";

  return (
    <div className="app-surface flex min-h-screen bg-[var(--tint)]">
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
      <GlassFilter />
      {/* Sticky full-height rail: stays in view while main scrolls. */}
      <aside className="app-rail sticky top-0 flex h-screen w-20 shrink-0 flex-col items-center gap-4 overflow-y-auto px-2 py-4">
        <Link
          href="/dashboard"
          aria-label="Vantera home"
          className="grid size-11 shrink-0 place-items-center text-[var(--nav-fg-strong)]"
        >
          <VanteraLogo className="size-8 text-[var(--nav-fg-strong)]" />
        </Link>

        <NotificationsBell notifications={notifications} />

        <DockNav badges={badges} />

        {/* Account + sign out, kept in the dock idiom — pinned to the bottom. */}
        <div className="mt-auto flex flex-col items-center gap-3 rounded-2xl border border-[var(--nav-line)] bg-white/[0.06] px-2 py-3 backdrop-blur-lg">
          <span className="group relative grid size-10 place-items-center rounded-full bg-[var(--nav-tile)] text-xs font-semibold text-[var(--nav-fg-strong)] ring-1 ring-[var(--nav-line)]">
            {initial}
            <DockTooltip>{email}</DockTooltip>
          </span>
          <form action={signOut}>
            <button
              type="submit"
              aria-label="Sign out"
              className="group relative grid size-12 place-items-center rounded-xl bg-[var(--nav-tile)] text-[var(--nav-fg)] ring-1 ring-[var(--nav-line)] transition-colors duration-200 hover:bg-[var(--nav-tile-hover)] hover:text-[var(--nav-fg-strong)] focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:outline-none"
            >
              <LogOut className="size-5" strokeWidth={2.1} />
              <DockTooltip>Sign out</DockTooltip>
            </button>
          </form>
        </div>
      </aside>
      {/* min-w-0 + overflow-x-clip: a flex child never stretches past the viewport, so no
          surface can ever produce a sideways-scrolling page — wide content clips instead. */}
      <main className="glass-cards min-w-0 flex-1 overflow-x-clip px-8 py-6">
        {connectionBanner && <TrialBanner {...connectionBanner} />}
        {trialBanner && <TrialBanner {...trialBanner} />}
        {children}
      </main>
      <CopilotOverlay />
    </div>
  );
}
