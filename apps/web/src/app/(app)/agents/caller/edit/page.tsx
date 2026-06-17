import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CallerWizard } from "../../caller-wizard";

export default async function EditCallerAgentPage() {
  const supabase = await createClient();

  const { data: agent } = await supabase
    .from("agents")
    .select("id, name, config, campaign_id")
    .eq("kind", "caller")
    .limit(1)
    .maybeSingle<{
      id: string;
      name: string;
      config: {
        cta?: string;
        booking_link?: string;
        voice?: { voice_id?: string; persona_name?: string; language?: string };
        brand_voice?: string | null;
        guardrails?: string | null;
        recording_consent_mode?: "one_party" | "two_party";
        calling_window?: { days?: string[]; start_local?: string; end_local?: string };
        max_attempts?: number;
      } | null;
      campaign_id: string | null;
    }>();
  if (!agent) redirect("/agents");

  const { data: scout } = await supabase
    .from("agents")
    .select("name, agent_icps(position, icps(name))")
    .eq("kind", "scout")
    .limit(1)
    .maybeSingle<{
      name: string;
      agent_icps: { position: number; icps: { name: string } | null }[];
    }>();
  if (!scout) redirect("/agents");

  const { data: linkAssets } = await supabase
    .from("agent_assets")
    .select("url")
    .eq("agent_id", agent.id)
    .eq("kind", "link");

  const icpNames = (scout.agent_icps ?? [])
    .sort((a, b) => a.position - b.position)
    .map((l) => l.icps?.name)
    .filter((n): n is string => Boolean(n));

  const links = (linkAssets ?? [])
    .map((a) => (a as { url: string | null }).url)
    .filter((u): u is string => Boolean(u))
    .join("\n");

  const cfg = agent.config ?? {};

  return (
    <CallerWizard
      scoutName={scout.name}
      icpNames={icpNames}
      edit={{
        name: agent.name,
        cta: cfg.cta ?? "",
        bookingLink: cfg.booking_link ?? "",
        voiceId: cfg.voice?.voice_id ?? "",
        personaName: cfg.voice?.persona_name ?? "",
        language: cfg.voice?.language ?? "en-US",
        brandVoice: cfg.brand_voice ?? "",
        guardrails: cfg.guardrails ?? "",
        recordingConsentMode: cfg.recording_consent_mode ?? "one_party",
        callingWindowDays: cfg.calling_window?.days ?? ["Mon", "Tue", "Wed", "Thu", "Fri"],
        startLocal: cfg.calling_window?.start_local ?? "09:00",
        endLocal: cfg.calling_window?.end_local ?? "17:00",
        maxAttempts: cfg.max_attempts ?? 3,
        links,
      }}
    />
  );
}
