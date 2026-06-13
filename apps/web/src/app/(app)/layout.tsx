import Link from "next/link";
import { redirect } from "next/navigation";
import { LogOut } from "lucide-react";
import { getGateData, toGateContext } from "@/lib/auth/context";
import { resolveGate } from "@/lib/auth/gate";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "./actions";
import { DockNav, DockTooltip } from "@/components/dock-nav";
import { AnimatedThemeToggle } from "@/components/ui/animated-theme-toggle";
import CopilotOverlay from "@/components/copilot/copilot-overlay";
import { GlassFilter } from "@/components/ui/liquid-glass";

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

  const email = data.user?.email ?? "";
  const initial = email.charAt(0).toUpperCase() || "?";

  return (
    <div className="flex min-h-screen">
      <GlassFilter />
      {/* Sticky full-height rail: stays in view while main scrolls. */}
      <aside className="sticky top-0 flex h-screen w-20 shrink-0 flex-col items-center gap-4 overflow-y-auto border-r border-border px-2 py-4">
        <Link
          href="/dashboard"
          aria-label="Vantera home"
          className="grid size-11 shrink-0 place-items-center rounded-xl bg-foreground font-heading text-lg font-semibold text-background shadow-lg"
        >
          V
        </Link>

        <AnimatedThemeToggle className="size-12 rounded-xl" />

        <DockNav badges={badges} />

        {/* Account + sign out, kept in the dock idiom — pinned to the bottom. */}
        <div className="mt-auto flex flex-col items-center gap-3 rounded-[28px] border border-black/10 bg-neutral-100/70 px-2 py-3 ring-1 ring-black/5 backdrop-blur-lg dark:border-white/10 dark:bg-neutral-900/80 dark:ring-white/10">
          <span className="group relative grid size-10 place-items-center rounded-full bg-muted text-xs font-semibold text-foreground ring-1 ring-border">
            {initial}
            <DockTooltip>{email}</DockTooltip>
          </span>
          <form action={signOut}>
            <button
              type="submit"
              aria-label="Sign out"
              className="dock-tile group relative grid size-12 place-items-center rounded-xl bg-gradient-to-b from-neutral-200/70 to-neutral-300/40 text-foreground/70 shadow-lg ring-1 ring-black/10 backdrop-blur-xl transition-transform duration-200 hover:translate-x-0.5 hover:scale-[1.05] hover:text-foreground focus-visible:scale-[1.05] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none dark:from-neutral-800/60 dark:to-neutral-900/70 dark:text-white/85 dark:ring-white/10 dark:hover:text-white"
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
