import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { CallerWizard } from "../../caller-wizard";

export default async function NewCallerAgentPage() {
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("agents")
    .select("id")
    .eq("kind", "caller")
    .limit(1)
    .maybeSingle();
  if (existing) redirect("/agents");

  const { data: scout } = await supabase
    .from("agents")
    .select("id, name, agent_icps(position, icps(name))")
    .eq("kind", "scout")
    .limit(1)
    .maybeSingle<{
      id: string;
      name: string;
      agent_icps: { position: number; icps: { name: string } | null }[];
    }>();

  if (!scout) {
    return (
      <Panel className="mx-auto flex max-w-xl flex-col gap-4 border-dashed">
        <div className="flex flex-col gap-2">
          <h2 className="font-heading text-lg font-semibold">Deploy a Prospect Agent first</h2>
          <p className="text-sm text-muted-foreground">
            The Caller Agent calls the leads your Prospect Agent finds — without one, it has no
            one to call.
          </p>
        </div>
        <Button asChild className="w-fit">
          <Link href="/agents/new/scout">Set up your Prospect Agent</Link>
        </Button>
      </Panel>
    );
  }

  const icpNames = (scout.agent_icps ?? [])
    .sort((a, b) => a.position - b.position)
    .map((l) => l.icps?.name)
    .filter((n): n is string => Boolean(n));

  return <CallerWizard scoutName={scout.name} icpNames={icpNames} />;
}
