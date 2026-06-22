import Link from "next/link";
import { Bot, PenLine, Radar } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Panel, Eyebrow } from "@/components/ui/panel";
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

  // value proof: real pipeline counts, never placeholders
  const [{ count: qualified }, { count: sourced }, { count: drafts }, { count: intentLeads }] =
    await Promise.all([
      supabase.from("leads").select("id", { count: "exact", head: true }).eq("status", "qualified"),
      supabase.from("leads").select("id", { count: "exact", head: true }),
      supabase
        .from("scheduled_sends")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending_review"),
      supabase.from("leads").select("id", { count: "exact", head: true }).eq("source", "intent"),
    ]);

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-8">
        <Eyebrow>Your agents</Eyebrow>
        <h1 className="font-heading mt-3 text-3xl font-semibold tracking-tight">Agents</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Deploy them once — they prospect, score, write, and reach out on LinkedIn for you.
        </p>
      </div>

      {updated && (
        <Panel className="mb-6 dark:bg-white/[0.06]">
          <p className="text-sm">
            <span className="font-medium">
              {(updated === "scout" ? scout?.name : copy?.name) ?? "Your agent"} updated.
            </span>{" "}
            The new configuration is saved and takes effect on its next run.
          </p>
        </Panel>
      )}

      {deployed && (
        <Panel className="mb-6 dark:bg-white/[0.06]">
          <p className="text-sm">
            {deployed === "scout" ? (
              <>
                <span className="font-medium">{scout?.name ?? "Your Prospect Agent"} is live.</span>{" "}
                First run starts within 15 minutes — qualified leads will appear under{" "}
                <Link href="/leads" className="underline underline-offset-2">
                  Leads
                </Link>
                . {!copy && "Next: deploy an Outreach Agent so every qualified lead gets a message drafted."}
              </>
            ) : deployed === "intent" ? (
              <>
                <span className="font-medium">{intent?.name ?? "Your Intent Agent"} is live.</span>{" "}
                It watches LinkedIn for people showing buying intent and qualifies them against your
                ICP — qualified leads appear under{" "}
                <Link href="/leads" className="underline underline-offset-2">
                  Leads
                </Link>
                .
              </>
            ) : (
              <>
                <span className="font-medium">{copy?.name ?? "Your Outreach Agent"} is live.</span>{" "}
                It drafts personalized outreach for every qualified lead — everything waits in your
                review queue, nothing sends without you.
              </>
            )}
          </p>
        </Panel>
      )}

      {!scout && !copy ? (
        <Panel className="flex flex-col items-center gap-4 border-dashed py-10 text-center">
          <Bot className="size-10 text-muted-foreground" />
          <div className="flex flex-col gap-2">
            <h2 className="font-heading text-lg font-semibold">Deploy your first agent</h2>
            <p className="mx-auto max-w-md text-pretty text-sm text-muted-foreground">
              The Prospect Agent hunts your ideal customers on a schedule, scores them, and keeps
              only the high-quality ones. Two minutes to set up.
            </p>
          </div>
          <Button asChild size="lg" data-copilot="deploy-scout">
            <Link href="/agents/new/scout">Set up your Prospect Agent</Link>
          </Button>
        </Panel>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {scout && (
            <AgentCard
              agent={scout}
              roleLabel="Prospect Agent"
              index={0}
              stats={[
                { label: "Leads sourced", value: sourced ?? 0 },
                { label: "Qualified", value: qualified ?? 0 },
              ]}
            />
          )}
          {copy ? (
            <AgentCard
              agent={copy}
              roleLabel="Outreach Agent"
              index={1}
              stats={[{ label: "Drafts awaiting review", value: drafts ?? 0 }]}
            />
          ) : (
            <AddAgentPanel
              icon={<PenLine className="size-6 text-muted-foreground" />}
              title="Add an Outreach Agent"
              body={`${scout?.name ?? "Your Prospect Agent"} is finding leads — an Outreach Agent writes a personalized message for each one and queues it for your review.`}
              href="/agents/new/copy"
              cta="Set up your Outreach Agent"
              copilot="deploy-outreach"
            />
          )}
          {intent ? (
            <AgentCard
              agent={intent}
              roleLabel="Intent Agent"
              index={2}
              stats={[{ label: "Intent leads", value: intentLeads ?? 0 }]}
            />
          ) : scout ? (
            <AddAgentPanel
              icon={<Radar className="size-6 text-muted-foreground" />}
              title="Add an Intent Agent"
              body={`Beyond ${scout.name}'s ICP search, an Intent Agent watches LinkedIn for people showing they're in-market — engaging with your niche or posting about the problem you solve — and qualifies them against the same bar.`}
              href="/agents/new/intent"
              cta="Set up your Intent Agent"
              copilot="deploy-intent"
            />
          ) : null}
        </div>
      )}
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
