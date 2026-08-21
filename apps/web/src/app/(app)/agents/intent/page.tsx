import { redirect } from "next/navigation";
import { loadAgentShowcase } from "../agent-showcase-data";
import { AgentShowcase } from "../agent-showcase";

export const metadata = { title: "Intent detection" };

export default async function IntentAgentPage() {
  const agents = await loadAgentShowcase();
  if (!agents.some((a) => a.kind === "intent")) redirect("/agents");
  return <AgentShowcase agents={agents} initialKind="intent" />;
}
