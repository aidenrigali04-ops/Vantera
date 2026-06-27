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

const NOTE_VERB: Record<AppNotification["kind"], string> = {
  reply: "replied — the sequence paused for you",
  converted: "booked a meeting",
  exhausted: "went cold after the full sequence",
  hot_signal: "is heating up — a fresh buying signal, worth reaching out now",
};
const NOTE_HREF: Record<AppNotification["kind"], string> = {
  reply: "/leads?tab=replied",
  converted: "/dashboard?view=pipeline",
  exhausted: "/leads?tab=rejected",
  hot_signal: "/leads?tab=qualified",
};

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

  // Unread lead events for the dock bell (reply paused / converted / exhausted).
  const { data: notes } = await supabase
    .from("lead_notifications")
    .select("id, kind, lead_id, created_at")
    .is("read_at", null)
    .order("created_at", { ascending: false })
    .limit(8)
    .returns<{ id: string; kind: AppNotification["kind"]; lead_id: string; created_at: string }[]>();
  const noteLeadIds = [...new Set((notes ?? []).map((n) => n.lead_id))];
  const { data: noteLeads } = noteLeadIds.length
    ? await supabase
        .from("leads")
        .select("id, first_name, company_name")
        .in("id", noteLeadIds)
        .returns<{ id: string; first_name: string | null; company_name: string | null }[]>()
    : { data: [] as { id: string; first_name: string | null; company_name: string | null }[] };
  const noteName = new Map(
    (noteLeads ?? []).map((l) => [l.id, l.company_name || l.first_name || "A lead"])
  );
  const notifications: AppNotification[] = (notes ?? []).map((n) => ({
    id: n.id,
    kind: n.kind,
    who: noteName.get(n.lead_id) ?? "A lead",
    verb: NOTE_VERB[n.kind],
    at: noteTimeAgo(n.created_at),
    href: NOTE_HREF[n.kind],
  }));

  const email = data.user?.email ?? "";
  const initial = email.charAt(0).toUpperCase() || "?";

  return (
    <div className="app-surface flex min-h-screen bg-[var(--tint)]">
      <GlassFilter />
      {/* Sticky full-height rail: stays in view while main scrolls. */}
      <aside className="sticky top-0 flex h-screen w-20 shrink-0 flex-col items-center gap-4 overflow-y-auto border-r border-[var(--hairline)] bg-white px-2 py-4">
        <Link
          href="/dashboard"
          aria-label="Vantera home"
          className="grid size-11 shrink-0 place-items-center text-foreground"
        >
          <VanteraLogo className="size-8 text-foreground" />
        </Link>

        <NotificationsBell notifications={notifications} />

        <DockNav badges={badges} />

        {/* Account + sign out, kept in the dock idiom — pinned to the bottom. */}
        <div className="mt-auto flex flex-col items-center gap-3 rounded-[28px] border border-[var(--hairline)] bg-white/80 px-2 py-3 ring-1 ring-black/5 backdrop-blur-lg">
          <span className="group relative grid size-10 place-items-center rounded-full bg-foreground/[0.06] text-xs font-semibold text-[var(--ink-2)] ring-1 ring-[var(--hairline)]">
            {initial}
            <DockTooltip>{email}</DockTooltip>
          </span>
          <form action={signOut}>
            <button
              type="submit"
              aria-label="Sign out"
              className="dock-tile group relative grid size-12 place-items-center rounded-xl bg-white text-[var(--ink-3)] shadow-sm ring-1 ring-[var(--hairline)] transition-transform duration-200 hover:translate-x-0.5 hover:scale-[1.05] hover:text-foreground focus-visible:scale-[1.05] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none"
            >
              <LogOut className="size-5 transition-transform duration-200 group-hover:scale-110" strokeWidth={2.1} />
              <DockTooltip>Sign out</DockTooltip>
            </button>
          </form>
        </div>
      </aside>
      <main className="glass-cards flex-1 px-8 py-6">{children}</main>
      <CopilotOverlay />
    </div>
  );
}
