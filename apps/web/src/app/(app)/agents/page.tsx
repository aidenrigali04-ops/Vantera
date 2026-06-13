import Link from "next/link";
import { Bot, PenLine } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

  // value proof: real pipeline counts, never placeholders
  const [{ count: qualified }, { count: sourced }, { count: drafts }] = await Promise.all([
    supabase.from("leads").select("id", { count: "exact", head: true }).eq("status", "qualified"),
    supabase.from("leads").select("id", { count: "exact", head: true }),
    supabase
      .from("scheduled_sends")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending_review"),
  ]);

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Agents</h1>
        <p className="text-sm text-muted-foreground">
          Your SDR team. Deploy them once — they prospect, score, and write for you.
        </p>
      </div>

      {updated && (
        <div className="mb-6 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
          <span className="font-medium">
            {(updated === "scout" ? scout?.name : copy?.name) ?? "Your agent"} updated.
          </span>{" "}
          The new configuration is saved and takes effect on its next run.
        </div>
      )}

      {deployed && (
        <div className="mb-6 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
          {deployed === "scout" ? (
            <>
              <span className="font-medium">{scout?.name ?? "Your Prospect Agent"} is live.</span>{" "}
              First run starts within 15 minutes — qualified leads will appear under{" "}
              <Link href="/leads" className="underline underline-offset-2">
                Leads
              </Link>
              . {!copy && "Next: deploy an Outreach Agent so every qualified lead gets a message drafted."}
            </>
          ) : (
            <>
              <span className="font-medium">{copy?.name ?? "Your Outreach Agent"} is live.</span>{" "}
              It drafts personalized outreach for every qualified lead — everything waits in your
              review queue, nothing sends without you.
            </>
          )}
        </div>
      )}

      {!scout && !copy ? (
        <Card className="border-dashed">
          <CardHeader className="items-center text-center">
            <Bot className="mx-auto size-10 text-muted-foreground" />
            <CardTitle>Deploy your first agent</CardTitle>
            <p className="max-w-md text-sm text-muted-foreground">
              The Prospect Agent hunts your ideal customers on a schedule, scores them, and keeps
              only the high-quality ones. Two minutes to set up.
            </p>
          </CardHeader>
          <CardContent className="flex justify-center pb-8">
            <Button asChild size="lg" data-copilot="deploy-scout">
              <Link href="/agents/new/scout">Set up your Prospect Agent</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {scout && (
            <AgentCard
              agent={scout}
              roleLabel="Prospect Agent"
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
              stats={[{ label: "Drafts awaiting review", value: drafts ?? 0 }]}
            />
          ) : (
            <Card className="border-dashed">
              <CardHeader>
                <PenLine className="size-6 text-muted-foreground" />
                <CardTitle className="text-base">Add an Outreach Agent</CardTitle>
                <p className="text-sm text-muted-foreground">
                  {scout?.name ?? "Your Prospect Agent"} is finding leads — an Outreach Agent
                  writes a personalized message for each one and queues it for your review.
                </p>
              </CardHeader>
              <CardContent>
                <Button asChild variant="outline" data-copilot="deploy-outreach">
                  <Link href="/agents/new/copy">Set up your Outreach Agent</Link>
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
