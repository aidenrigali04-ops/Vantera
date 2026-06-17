import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ResponderWizard } from "../../responder-wizard";

export default async function NewResponderAgentPage() {
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("agents")
    .select("id")
    .eq("kind", "responder")
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
            The Responder qualifies inbound leads against the bar your Prospect Agent sets — without
            one, it has nothing to qualify against.
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

  return <ResponderWizard scoutName={scout.name} icpNames={icpNames} />;
}
