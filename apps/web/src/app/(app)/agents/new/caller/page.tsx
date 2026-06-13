import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
      <Card className="mx-auto max-w-xl border-dashed">
        <CardHeader>
          <CardTitle>Deploy a Prospect Agent first</CardTitle>
          <p className="text-sm text-muted-foreground">
            The Caller Agent calls the leads your Prospect Agent finds — without one, it has no
            one to call.
          </p>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link href="/agents/new/scout">Set up your Prospect Agent</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const icpNames = (scout.agent_icps ?? [])
    .sort((a, b) => a.position - b.position)
    .map((l) => l.icps?.name)
    .filter((n): n is string => Boolean(n));

  return <CallerWizard scoutName={scout.name} icpNames={icpNames} />;
}
