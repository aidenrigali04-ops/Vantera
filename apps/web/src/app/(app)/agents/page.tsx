import Link from "next/link";
import { PenLine, Radar, Search } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { AgentCard, type AgentRow } from "./agent-card";

export default async function AgentsPage({
  searchParams,
}: {
  searchParams: Promise<{ deployed?: string; updated?: string }>;
}) {
  const { deployed, updated } = await searchParams;
  const supabase = await createClient();

  const { data: agents } = await supabase
    .from("agents")
    .select("id, kind, name, status, config, run_at_time, cadence, timezone, next_run_at, last_run_at, deployed_at, campaign_id, campaigns(send_mode), agent_icps(position, icps(name))")
    .order("kind", { ascending: false }); // scout first

  const scout = (agents as AgentRow[] | null)?.find((a) => a.kind === "scout") ?? null;
  const copy = (agents as AgentRow[] | null)?.find((a) => a.kind === "copy") ?? null;
  const intent = (agents as AgentRow[] | null)?.find((a) => a.kind === "intent") ?? null;

  // value proof: real pipeline counts, never placeholders.
  // "Qualified" = everyone who PASSED the bar, cumulatively — not just the waiting pool
  // (status='qualified'). Leads that qualified and already advanced into outreach
  // (in_campaign), got a reply, or converted still count: they were qualified. Counting
  // only the waiting pool made a healthy 40+ look like "3 qualified" the instant the
  // pipeline drained them into outreach.
  const QUALIFIED_PLUS = ["qualified", "enriched", "in_campaign", "replied", "converted"];
  const [{ count: qualified }, { count: sourced }, { count: drafts }, { count: intentLeads }] =
    await Promise.all([
      supabase.from("leads").select("id", { count: "exact", head: true }).in("status", QUALIFIED_PLUS),
      supabase.from("leads").select("id", { count: "exact", head: true }),
      supabase
        .from("scheduled_sends")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending_review"),
      supabase.from("leads").select("id", { count: "exact", head: true }).eq("source", "intent"),
    ]);

  return (
    // One-screen on desktop: the page never scrolls — content scrolls in its own region.
    <div className="mx-auto flex w-full max-w-[1400px] flex-col lg:h-[calc(100dvh-3rem)]">
      <div className="mb-6 shrink-0 border-b border-[var(--hairline)] pb-5">
        <h1 className="text-2xl font-semibold tracking-tight">Your system</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Set it up once. Your pipeline finds and qualifies the right people on LinkedIn, then your
          relationship layer turns every qualified prospect into a conversation.
        </p>
      </div>

      <div className="min-h-0 flex-1 lg:overflow-y-auto">

      {updated && (
        <Panel className="mb-6">
          <p className="text-sm">
            <span className="font-medium">
              {(updated === "scout" ? scout?.name : copy?.name) ?? "Your agent"} updated.
            </span>{" "}
            The new configuration is saved and takes effect on its next run.
          </p>
        </Panel>
      )}

      {deployed && (
        <Panel className="mb-6">
          <p className="text-sm">
            {deployed === "scout" ? (
              <>
                <span className="font-medium">{scout?.name ?? "Prospect sourcing"} is live.</span>{" "}
                First run starts within 15 minutes — qualified leads will appear under{" "}
                <Link href="/leads" className="underline underline-offset-2">
                  Leads
                </Link>
                . {!copy && "Next: set up outreach so every qualified lead gets a message drafted."}
              </>
            ) : deployed === "intent" ? (
              <>
                <span className="font-medium">{intent?.name ?? "Intent detection"} is live.</span>{" "}
                It watches LinkedIn for people showing buying intent and qualifies them against your
                ICP — qualified leads appear under{" "}
                <Link href="/leads" className="underline underline-offset-2">
                  Leads
                </Link>
                .
              </>
            ) : (
              <>
                <span className="font-medium">{copy?.name ?? "Outreach"} is live.</span>{" "}
                It drafts personalized outreach for every qualified lead — everything waits in your
                review queue, nothing sends without you.
              </>
            )}
          </p>
        </Panel>
      )}

      {!scout && !copy ? (
        <Panel className="flex flex-col items-center gap-4 border-dashed py-10 text-center">
          {/* Search = sourcing; Radar stays reserved for intent (the In-market mark). */}
          <Search className="size-10 text-[var(--cyan-strong)]" />
          <div className="flex flex-col gap-2">
            <h2 className="font-heading text-lg font-semibold">Set up your pipeline</h2>
            <p className="mx-auto max-w-md text-pretty text-sm text-muted-foreground">
              Prospect sourcing hunts your ideal customers on a schedule, scores them, and keeps only
              the high-quality ones. Two minutes to set up.
            </p>
          </div>
          <Button asChild size="lg" data-copilot="deploy-scout">
            <Link href="/agents/new/scout">Set up prospect sourcing</Link>
          </Button>
        </Panel>
      ) : (
        // All three agents in one row — sourcing, intent, and outreach side by side (the full
        // system at a glance) rather than split across stacked sections.
        <div className="grid gap-4 lg:grid-cols-3">
          {scout ? (
            <AgentCard
              agent={scout}
              roleLabel="Prospect sourcing"
              index={0}
              stats={[
                { label: "Leads sourced", value: sourced ?? 0 },
                { label: "Qualified", value: qualified ?? 0 },
              ]}
            />
          ) : (
            <AddAgentPanel
              icon={<Search className="size-6 text-[var(--cyan-strong)]" />}
              title="Set up prospect sourcing"
              body="Prospect sourcing hunts your ideal customers on a schedule, scores them, and keeps only the high-quality ones."
              href="/agents/new/scout"
              cta="Set up prospect sourcing"
              copilot="deploy-scout"
            />
          )}
          {intent ? (
            <AgentCard
              agent={intent}
              roleLabel="Intent detection"
              index={1}
              stats={[{ label: "Intent leads", value: intentLeads ?? 0 }]}
            />
          ) : (
            <AddAgentPanel
              icon={<Radar className="size-6 text-[var(--cyan-strong)]" />}
              title="Add intent detection"
              body={`Beyond ${scout?.name ?? "your pipeline"}'s ICP search, intent detection watches LinkedIn for people showing they're in-market — engaging your niche or posting about the problem you solve — and qualifies them against the same bar.`}
              href="/agents/new/intent"
              cta="Set up intent detection"
              copilot="deploy-intent"
            />
          )}
          {copy ? (
            <AgentCard
              agent={copy}
              roleLabel="Outreach & conversations"
              index={2}
              stats={[{ label: "Drafts awaiting review", value: drafts ?? 0 }]}
            />
          ) : (
            <AddAgentPanel
              icon={<PenLine className="size-6 text-[var(--cyan-strong)]" />}
              title="Set up outreach"
              body={`${scout?.name ?? "Your pipeline"} is finding leads — outreach writes a personalized message for each one and queues it for your review.`}
              href="/agents/new/copy"
              cta="Set up outreach"
              copilot="deploy-outreach"
            />
          )}
        </div>
      )}
      </div>
    </div>
  );
}

function AddAgentPanel({
  icon,
  title,
  body,
  href,
  cta,
  copilot,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  href: string;
  cta: string;
  copilot: string;
}) {
  return (
    <Panel className="flex flex-col gap-3 border-dashed">
      {icon}
      <h3 className="font-heading text-base font-semibold">{title}</h3>
      <p className="text-sm text-muted-foreground">{body}</p>
      <Button asChild variant="outline" data-copilot={copilot} className="mt-1 w-fit">
        <Link href={href}>{cta}</Link>
      </Button>
    </Panel>
  );
}
