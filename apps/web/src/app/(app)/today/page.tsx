import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadToday } from "@/lib/today/data";
import { TodayClient } from "./today-client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = { title: "Today" };

type Tab = "queue" | "replies" | "activity";
const TABS: readonly Tab[] = ["queue", "replies", "activity"];

/**
 * Today — the post-payment home (Dashboard blueprint v1.0). A launchpad that answers, top
 * to bottom: is anything broken · what needs me · is it working · what exactly is waiting ·
 * what did it do while I was gone. One server round-trip (`loadToday`), server-formatted
 * times, zero client Date.now().
 *
 * First session (§8): until the user's first approval session has ended, /today forwards to
 * the queue — the queue is the post-payment landing, Today becomes the home afterwards.
 */
export default async function TodayPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; draft?: string }>;
}) {
  const { tab: tabParam, draft } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const load = await loadToday(supabase, user.id);
  if (!load) redirect("/onboarding");
  if (load.view.state === "first_session") redirect("/approvals?first=1");

  const tab: Tab = TABS.includes(tabParam as Tab) ? (tabParam as Tab) : load.view.defaultTab;

  return <TodayClient view={load.view} tab={tab} openDraftId={draft ?? null} />;
}
