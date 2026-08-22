import Link from "next/link";
import { ArrowRight, PenLine, Radar, Search } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { AgentCard, type AgentRow } from "./agent-card";
import { agentAttention, type AgentRunRow } from "./agent-health";

export const metadata = { title: "Playbook" };

// Server-formatted relative label (no client Date.now(); mirrors the dashboard convention).
function agoLabel(iso: string | null): string | null {
  if (!iso) return null;
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

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
  // (status='qualified'). Prospects that qualified and already advanced into outreach
  // (in_campaign), got a reply, or converted still count: they were qualified. Counting
  // only the waiting pool made a healthy 40+ look like "3 qualified" the instant the
  // pipeline drained them into outreach.
  const QUALIFIED_PLUS = ["qualified", "enriched", "in_campaign", "replied", "converted"];
  const [{ count: qualified }, { count: sourced }, { count: drafts }, { count: intentLeads }, { data: runRows }, { count: liActive }] =
    await Promise.all([
      supabase.from("leads").select("id", { count: "exact", head: true }).in("status", QUALIFIED_PLUS),
      supabase.from("leads").select("id", { count: "exact", head: true }),
      supabase
        .from("scheduled_sends")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending_review"),
      supabase.from("leads").select("id", { count: "exact", head: true }).eq("source", "intent"),
      // T4 operate path: the latest recorded runs → what-happened lines + honest statuses.
      supabase
        .from("agent_runs")
        .select("agent_id, kind, status, summary, note, started_at")
        .order("started_at", { ascending: false })
        .limit(12)
        .returns<AgentRunRow[]>(),
      supabase
        .from("linkedin_accounts")
        .select("id", { count: "exact", head: true })
        .eq("status", "active"),
    ]);

  const latestRunByAgent = new Map<string, AgentRunRow>();
  for (const r of runRows ?? []) if (!latestRunByAgent.has(r.agent_id)) latestRunByAgent.set(r.agent_id, r);
  const linkedinActive = liActive ?? 0;
  const health = (a: AgentRow | null) =>
    a
      ? {
          lastRun: latestRunByAgent.get(a.id) ?? null,
          lastRunAgo: agoLabel(latestRunByAgent.get(a.id)?.started_at ?? null),
          attention: agentAttention({
            kind: a.kind,
            status: a.status,
            sendMode: a.campaigns?.send_mode ?? null,
            linkedinActive,
            lastRun: latestRunByAgent.get(a.id) ?? null,
          }),
        }
      : { lastRun: null, lastRunAgo: null, attention: null };

  return (
    // One-screen on desktop: the page never scrolls — content scrolls in its own region.
    <div className="mx-auto flex w-full max-w-[1400px] flex-col lg:h-[calc(100dvh-3rem)]">
      <div className="mb-6 shrink-0 border-b border-[var(--hairline)] pb-5">
        <h1 className="text-2xl font-semibold tracking-tight">Playbook</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Set it up once. Vera finds and qualifies the right people on LinkedIn, turns every
          qualified prospect into a conversation — and gets smarter every week, starting from
          proven plays.{" "}
          {/* T4: the page that makes the learning claim now links to its proof. */}
          <Link
            href="/dashboard?view=analytics"
            className="inline-flex items-center gap-1 font-medium text-[var(--cyan-strong)] underline-offset-4 hover:underline"
          >
            See what Vera&apos;s learning <ArrowRight className="size-3.5" />
          </Link>
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
                First run starts within 15 minutes — qualified prospects will appear under{" "}
                <Link href="/prospects" className="underline underline-offset-2">
                  Prospects
                </Link>
                . {!copy && "Next: set up outreach so every qualified prospect gets a message drafted."}
              </>
            ) : deployed === "intent" ? (
              <>
                <span className="font-medium">{intent?.name ?? "Intent detection"} is live.</span>{" "}
                It watches LinkedIn for people showing buying intent and qualifies them against your
                ICP — qualified prospects appear under{" "}
                <Link href="/prospects" className="underline underline-offset-2">
                  Prospects
                </Link>
                .
              </>
            ) : (
              <>
                <span className="font-medium">{copy?.name ?? "Outreach"} is live.</span>{" "}
                It drafts personalized outreach for every qualified prospect — everything waits in
                Approvals, nothing sends without you.
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
            <Link href="/playbook/new/scout">Set up prospect sourcing</Link>
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
                { label: "Prospects sourced", value: sourced ?? 0 },
                { label: "Qualified", value: qualified ?? 0 },
              ]}
              {...health(scout)}
            />
          ) : (
            <AddAgentPanel
              icon={<Search className="size-6 text-[var(--cyan-strong)]" />}
              title="Set up prospect sourcing"
              body="Prospect sourcing hunts your ideal customers on a schedule, scores them, and keeps only the high-quality ones."
              href="/playbook/new/scout"
              cta="Set up prospect sourcing"
              copilot="deploy-scout"
            />
          )}
          {intent ? (
            <AgentCard
              agent={intent}
              roleLabel="Intent detection"
              index={1}
              stats={[{ label: "Intent prospects", value: intentLeads ?? 0 }]}
              {...health(intent)}
            />
          ) : (
            <AddAgentPanel
              icon={<Radar className="size-6 text-[var(--cyan-strong)]" />}
              title="Add intent detection"
              body={`Beyond ${scout?.name ?? "your pipeline"}'s ICP search, intent detection watches LinkedIn for people showing they're in-market — engaging your niche or posting about the problem you solve — and qualifies them against the same bar.`}
              href="/playbook/new/intent"
              cta="Set up intent detection"
              copilot="deploy-intent"
            />
          )}
          {copy ? (
            <AgentCard
              agent={copy}
              roleLabel="Outreach & conversations"
              index={2}
              stats={[{ label: "Drafts awaiting approval", value: drafts ?? 0 }]}
              {...health(copy)}
            />
          ) : (
            <AddAgentPanel
              icon={<PenLine className="size-6 text-[var(--cyan-strong)]" />}
              title="Set up outreach"
              body={`${scout?.name ?? "Your pipeline"} is finding prospects — outreach writes a personalized message for each one and queues it in Approvals.`}
              href="/playbook/new/copy"
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
