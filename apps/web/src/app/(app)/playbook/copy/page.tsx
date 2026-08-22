import { redirect } from "next/navigation";
import { loadAgentShowcase } from "../agent-showcase-data";
import { AgentShowcase } from "../agent-showcase";

export const metadata = { title: "Outreach" };

export default async function CopyAgentPage() {
  const agents = await loadAgentShowcase();
  if (!agents.some((a) => a.kind === "copy")) redirect("/playbook");
  return <AgentShowcase agents={agents} initialKind="copy" />;
}
