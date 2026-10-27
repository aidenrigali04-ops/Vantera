import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { IntentWizard } from "../../intent-wizard";

export const metadata = { title: "Edit intent detection" };

type IntentConfig = {
  watch?: Partial<Record<"creators" | "competitors" | "keywords" | "hashtags", unknown>>;
  signals?: Partial<Record<"engagement" | "content" | "follows", unknown>>;
};

const strings = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];

export default async function EditIntentAgentPage() {
  const supabase = await createClient();

  // RLS scopes both reads to the session's account (rule 02)
  const [{ data: agent }, { data: scout }] = await Promise.all([
    supabase
      .from("agents")
      .select("name, config, run_at_time, cadence, timezone")
      .eq("kind", "intent")
      .limit(1)
      .maybeSingle<{
        name: string;
        config: IntentConfig | null;
        run_at_time: string | null;
        cadence: "daily" | "weekly" | "intraday" | null;
        timezone: string | null;
      }>(),
    supabase.from("agents").select("name").eq("kind", "scout").limit(1).maybeSingle<{ name: string }>(),
  ]);
  if (!agent) redirect("/playbook");

  const watch = agent.config?.watch ?? {};
  const signals = agent.config?.signals ?? {};

  return (
    <IntentWizard
      scoutName={scout?.name ?? "your Prospect Agent"}
      edit={{
        name: agent.name,
        watch: {
          creators: strings(watch.creators),
          competitors: strings(watch.competitors),
          keywords: strings(watch.keywords),
          hashtags: strings(watch.hashtags),
        },
        signals: {
          engagement: signals.engagement === true,
          content: signals.content === true,
          follows: signals.follows === true,
        },
        // Postgres returns time as HH:MM:SS — the picker + validation expect HH:MM
        runAtTime: (agent.run_at_time ?? "08:00").slice(0, 5),
        cadence: agent.cadence ?? "daily",
        timezone: agent.timezone ?? "UTC",
      }}
    />
  );
}
